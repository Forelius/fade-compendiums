import fs from "fs/promises";
import path from "path";

/**
 * Database Converter - ES6 Class for converting FoundryVTT database formats
 */
class dbConvert {
    static AVAILABLE_PACKS = ["actors", "items", "macros", "rollTables"];

    constructor(packName = "actors") {
        this.validatePackName(packName);
        this.packName = packName;
        this.paths = this.getPackPaths(packName);
    }

    /**
     * Validate pack name against available packs
     */
    validatePackName(packName) {
        if (!dbConvert.AVAILABLE_PACKS.includes(packName)) {
            throw new Error(`Invalid pack name: ${packName}. Available packs: ${dbConvert.AVAILABLE_PACKS.join(", ")}`);
        }
    }

    /**
     * Get pack paths for the current pack
     */
    getPackPaths(packName) {
        const dbFile = path.join(process.cwd(), "packs", `${packName}.db`);
        const outputDir = path.join(process.cwd(), "packsrc", packName);
        return { dbFile, outputDir };
    }

    /**
     * Main extract method - extracts documents from .db file to individual JSON files
     * @param {string} dbFilePath - Path to the .db file to process
     */
    async extract(dbFilePath = null) {
        const dbFile = dbFilePath || this.paths.dbFile;
        
        // Ensure the .db file exists
        try {
            await fs.access(dbFile);
        } catch (error) {
            throw new Error(`Database file not found: ${dbFile}`);
        }

        // Delete destination folder before extracting.
        this.deletePackFolder(this.packName);

        // Read and parse the .db file
        const dbContent = await fs.readFile(dbFile, 'utf8');
        const documents = JSON.parse(dbContent);

        // Ensure output directory structure exists
        await this.ensureDirectoryStructure();

        // Extract folders first and get folder documents for path resolution
        const folderDocuments = await this.extractFolders(documents);
        
        // Extract individual documents with folder structure
        await this.extractDocuments(documents, folderDocuments);

        console.log(`Extraction completed for: ${dbFile}`);
    }

    /**
     * Extract folder documents to _folders.json file
     * @param {Object} documents - All documents from the .db file
     * @returns {Object} - The folder documents for use in path resolution
     */
    async extractFolders(documents) {
        const folderDocuments = {};
        
        // Find all documents with keys starting with "!folders"
        for (const [key, document] of Object.entries(documents)) {
            if (key.startsWith('!folders')) {
                folderDocuments[key] = document;
            }
        }

        // Only create _folders.json if there are folder documents
        if (Object.keys(folderDocuments).length > 0) {
            const foldersFilePath = path.join(this.paths.outputDir, '_folders.json');
            await fs.writeFile(foldersFilePath, JSON.stringify(folderDocuments, null, 2), 'utf8');
            console.log(`Extracted ${Object.keys(folderDocuments).length} folder documents to: ${foldersFilePath}`);
        } else {
            console.log('No folder documents found to extract.');
        }
        
        return folderDocuments;
    }

    /**
     * Ensure the packsrc directory structure exists
     */
    async ensureDirectoryStructure() {
        try {
            await fs.mkdir(this.paths.outputDir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create output directory: ${this.paths.outputDir} - ${error.message}`);
        }
    }

    /**
     * Delete the pack type folder and all its contents
     * @param {string} packName - Name of the pack folder to delete
     */
    async deletePackFolder(packName) {
        this.validatePackName(packName);
        
        const packFolderPath = path.join(process.cwd(), "packsrc", packName);
        
        try {
            // Check if the folder exists before attempting to delete
            await fs.access(packFolderPath);
            
            // Delete the folder and all its contents recursively
            await fs.rm(packFolderPath, { recursive: true, force: true });
            console.log(`Successfully deleted pack folder: ${packFolderPath}`);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`Pack folder does not exist: ${packFolderPath}`);
            } else {
                throw new Error(`Failed to delete pack folder: ${packFolderPath} - ${error.message}`);
            }
        }
    }

    /**
     * Sanitize filename to be Windows and Linux compliant
     * @param {string} filename - The filename to sanitize
     * @returns {string} - Sanitized filename with special characters replaced by underscores
     */
    sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            return 'unnamed';
        }
        
        // Replace invalid characters with underscores
        // Windows invalid chars: < > : " | ? * \ /
        // Also replace spaces and other special chars for consistency
        return filename
            .replace(/[<>:"|?*\\/\s&]+/g, '_')
            .replace(/_{2,}/g, '_')  // Replace multiple underscores with single
            .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
            .trim() || 'unnamed';
    }

    /**
     * Resolve folder path structure from document folder references
     * @param {Object} document - The document to get folder path for
     * @param {Object} folderDocuments - All folder documents for reference lookup
     * @returns {string} - Sanitized folder path relative to pack root
     */
    resolveFolderPath(document, folderDocuments) {
        if (!document.folder) {
            return ''; // Document is at root level
        }

        const folderPath = [];
        let currentFolderId = document.folder;

        // Traverse up the folder hierarchy
        while (currentFolderId) {
            const folderKey = `!folders!${currentFolderId}`;
            const folderDoc = folderDocuments[folderKey];
            
            if (!folderDoc) {
                console.warn(`Warning: Folder reference not found: ${folderKey}`);
                break;
            }

            // Add sanitized folder name to the beginning of path
            folderPath.unshift(this.sanitizeFilename(folderDoc.name));
            
            // Move to parent folder
            currentFolderId = folderDoc.folder;
        }

        return folderPath.join(path.sep);
    }

    /**
     * Extract and organize embedded documents into their parent documents
     * @param {Object} allDocuments - All documents from the database
     * @returns {Object} - Object containing topLevelDocuments and embeddedDocuments
     */
    organizeDocuments(allDocuments) {
        const topLevelDocuments = {};
        const embeddedDocuments = {};

        // Separate top-level and embedded documents
        for (const [key, document] of Object.entries(allDocuments)) {
            // Skip folder documents (handled separately)
            if (key.startsWith('!folders!')) {
                continue;
            }

            // Check if this is an embedded document (contains a dot in the type part)
            // Pattern: !<type>.<subtype>!<parentId>.<childId>
            const keyMatch = key.match(/^!([^!]+)!(.+)$/);
            if (keyMatch) {
                const [, typeSection, idSection] = keyMatch;
                
                if (typeSection.includes('.')) {
                    // This is an embedded document
                    const [parentType, childType] = typeSection.split('.');
                    const [parentId, childId] = idSection.split('.');
                    
                    if (parentId && childId) {
                        const parentKey = `!${parentType}!${parentId}`;
                        
                        if (!embeddedDocuments[parentKey]) {
                            embeddedDocuments[parentKey] = [];
                        }
                        
                        embeddedDocuments[parentKey].push({
                            key: key,
                            document: document,
                            childType: childType,
                            childId: childId
                        });
                    }
                } else {
                    // This is a top-level document
                    topLevelDocuments[key] = { ...document };
                }
            }
        }

        // Add embedded documents to their parent documents
        for (const [parentKey, embeddedList] of Object.entries(embeddedDocuments)) {
            if (topLevelDocuments[parentKey]) {
                topLevelDocuments[parentKey].embedded = embeddedList.map(item => item.document);
            }
        }

        return { topLevelDocuments, embeddedDocuments };
    }

    /**
     * Extract documents to individual JSON files with folder structure
     * @param {Object} allDocuments - All documents from the database
     * @param {Object} folderDocuments - All folder documents for path resolution
     */
    async extractDocuments(allDocuments, folderDocuments) {
        const { topLevelDocuments } = this.organizeDocuments(allDocuments);
        
        let extractedCount = 0;
        
        for (const [key, document] of Object.entries(topLevelDocuments)) {
            try {
                // Get folder path for this document
                const folderPath = this.resolveFolderPath(document, folderDocuments);
                
                // Create sanitized filename
                const sanitizedName = this.sanitizeFilename(document.name);
                const filename = `${sanitizedName}.json`;
                
                // Build full file path
                const fullFolderPath = path.join(this.paths.outputDir, folderPath);
                const fullFilePath = path.join(fullFolderPath, filename);
                
                // Ensure directory exists
                await fs.mkdir(fullFolderPath, { recursive: true });
                
                // Write document to file
                await fs.writeFile(fullFilePath, JSON.stringify(document, null, 2), 'utf8');
                
                extractedCount++;
                
            } catch (error) {
                console.error(`Error extracting document ${key}:`, error.message);
            }
        }
        
        console.log(`Extracted ${extractedCount} documents to individual JSON files.`);
    }
}

/**
 * CLI Processor for dbConvert operations
 */
class dbConvertCLI {
    constructor() {
        this.args = process.argv.slice(2);
        this.command = this.args[0];
        this.options = this.parseArgs();
    }

    /**
     * Parse command line arguments
     */
    parseArgs() {
        const options = {};
        
        for (let i = 1; i < this.args.length; i++) {
            const arg = this.args[i];
            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                const value = this.args[i + 1];
                if (value && !value.startsWith('--')) {
                    options[key] = value;
                    i++; // Skip next arg as it's the value
                } else {
                    options[key] = true;
                }
            }
        }
        
        return options;
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log(`
dbConvert - FoundryVTT Database Converter

Usage: node dbConvert.mjs <command> [options]

Commands:
  extract                 Extract documents from .db file to individual JSON files
  help                    Show this help message

Options:
  --pack <name>          Specify pack name (actors, items, macros, rollTables)
  --file <path>          Specify custom .db file path
  --help                 Show help

Examples:
  node "scripts/build/dbConvert.mjs" extract --pack actors
  node "scripts/build/dbConvert.mjs" extract --file ./packs/actors.db
  node "scripts/build/dbConvert.mjs" help
        `);
    }

    /**
     * Run the CLI command
     */
    async run() {
        try {
            switch (this.command) {
                case 'extract':
                    await this.handleExtract();
                    break;
                case 'help':
                case '--help':
                case undefined:
                    this.showHelp();
                    break;
                default:
                    console.error(`Unknown command: ${this.command}`);
                    this.showHelp();
                    process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }

    /**
     * Handle the extract command
     */
    async handleExtract() {
        const packName = this.options.pack || 'actors';
        const customFile = this.options.file;

        const converter = new dbConvert(packName);
        
        if (customFile) {
            await converter.extract(customFile);
        } else {
            await converter.extract();
        }
    }
}

// Export classes
export { dbConvert, dbConvertCLI };

// CLI runner - only run if this file is executed directly
if (process.argv && process.argv.length > 2) {
    const cli = new dbConvertCLI();
    cli.run();
}