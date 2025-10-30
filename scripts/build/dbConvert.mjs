import fs from "fs/promises";
import path from "path";

/**
 * Database Converter - ES6 Class for converting FoundryVTT database formats
 */
class dbConvert {
    static AVAILABLE_PACKS = ["actors", "items", "macros", "rollTables", "journals", "scenes"];

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
        await this.deletePackSourceFolder(this.packName);

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
    async deletePackSourceFolder(packName) {
        this.validatePackName(packName);
        
        const packSourceFolder = path.join(process.cwd(), "packsrc", packName);
        
        try {
            // Check if the folder exists before attempting to delete
            await fs.access(packSourceFolder);
            
            // Delete the folder and all its contents recursively
            await fs.rm(packSourceFolder, { recursive: true, force: true });
            console.log(`Successfully deleted pack folder: ${packSourceFolder}`);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`Pack folder does not exist: ${packSourceFolder}`);
            } else {
                throw new Error(`Failed to delete pack folder: ${packSourceFolder} - ${error.message}`);
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
            .replace(/[<>:"|?*\\/\s&()]+/g, '_')
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
            // Top-level documents also save their original key
            document._originalKey = key;

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

                        this.removeStats(document);

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
                topLevelDocuments[parentKey].embedded = embeddedList.map(item => ({
                    _originalKey: item.key,
                    ...item.document
                }));
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

    /**
    * Do stuff to the document
    * @param {Object} documents - All documents from the .db file
    */
    async removeStats(document) {
        document._stats = {};
    }

    /**
     * Compile individual JSON files back into a .db file
     * @param {string} packName - Name of the pack to compile
     */
    async compile(packName) {
        if (!packName) {
            throw new Error('Pack name is required for compilation');
        }
        
        this.packName = packName;
        this.paths = this.getPackPaths(packName);
        const packsrcPath = this.paths.outputDir;
        
        // Check if packsrc directory exists
        if (!(await this.directoryExists(packsrcPath))) {
            throw new Error(`Pack source directory not found: ${packsrcPath}`);
        }
        
        console.log(`Starting compilation of pack: ${packName}`);
        console.log(`Reading from: ${packsrcPath}`);
        
        try {
            // Step 1: Collect all JSON files from packsrc folder structure
            console.log('Collecting JSON files...');
            const collectedData = await this.collectJsonFiles(packsrcPath);
            
            // Step 2: Reconstruct embedded documents from parent documents' embedded arrays
            console.log('Reconstructing embedded documents...');
            const allDocuments = this.reconstructEmbeddedDocuments(collectedData);
            
            // Step 3: Write compiled documents to .db file format
            console.log('Writing compiled database...');
            await this.writeCompiledDatabase(allDocuments, packName);
            
            console.log(`Compilation completed successfully for pack: ${packName}`);
            
        } catch (error) {
            console.error(`Error during compilation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Collect all JSON files from the packsrc folder structure
     * @param {string} packsrcPath - Path to the packsrc directory
     * @returns {Object} - Object containing folders and documents
     */
    async collectJsonFiles(packsrcPath) {
        const result = {
            folders: {},
            documents: []
        };
        
        // Read _folders.json if it exists
        const foldersPath = path.join(packsrcPath, '_folders.json');
        try {
            const foldersContent = await fs.readFile(foldersPath, 'utf8');
            result.folders = JSON.parse(foldersContent);
            console.log(`Loaded ${Object.keys(result.folders).length} folder documents from _folders.json`);
        } catch (error) {
            console.warn(`No _folders.json found or error reading it: ${error.message}`);
        }
        
        // Recursively collect all JSON files (except _folders.json)
        await this.collectJsonFilesRecursive(packsrcPath, result.documents, packsrcPath);
        
        console.log(`Collected ${result.documents.length} document files`);
        return result;
    }

    /**
     * Recursively collect JSON files from a directory
     * @param {string} dirPath - Directory path to search
     * @param {Array} documents - Array to collect documents into
     * @param {string} basePath - Base path for calculating relative paths
     */
    async collectJsonFilesRecursive(dirPath, documents, basePath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    await this.collectJsonFilesRecursive(fullPath, documents, basePath);
                } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== '_folders.json') {
                    // Read and parse JSON file
                    try {
                        const content = await fs.readFile(fullPath, 'utf8');
                        const document = JSON.parse(content);
                        documents.push({
                            filePath: fullPath,
                            relativePath: path.relative(basePath, fullPath),
                            document: document
                        });
                    } catch (error) {
                        console.warn(`Error reading JSON file ${fullPath}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.warn(`Error reading directory ${dirPath}: ${error.message}`);
        }
    }

    /**
     * Reconstruct embedded documents from parent documents' embedded arrays
     * @param {Object} collectedData - Object containing folders and documents from collectJsonFiles
     * @returns {Object} - Object with all documents keyed by their database keys
     */
    reconstructEmbeddedDocuments(collectedData) {
        const allDocuments = {};
        
        // Add folder documents first
        for (const [key, folderDoc] of Object.entries(collectedData.folders)) {
            allDocuments[key] = folderDoc;
        }
        
        // Process each document file
        for (const fileData of collectedData.documents) {
            const document = fileData.document;
            
            // Create a clean copy of the document without the embedded array
            const cleanDocument = { ...document };
            delete cleanDocument.embedded;
            
            // Add the top-level document
            allDocuments[document._originalKey] = cleanDocument;
            
            // Process embedded documents if they exist
            if (document.embedded && Array.isArray(document.embedded)) {
                for (const embeddedDoc of document.embedded) {
                    if (embeddedDoc._originalKey) {
                        // Use the stored original key
                        const embeddedKey = embeddedDoc._originalKey;
                        
                        // Create a clean copy without the _originalKey property
                        const cleanEmbeddedDoc = { ...embeddedDoc };
                        delete cleanEmbeddedDoc._originalKey;
                        
                        allDocuments[embeddedKey] = cleanEmbeddedDoc;
                    } else {
                        console.warn(`Embedded document missing _originalKey in ${fileData.relativePath}`);
                    }
                }
            }
        }
        
        console.log(`Reconstructed ${Object.keys(allDocuments).length} total documents`);
        return allDocuments;
    }

    /**
     * Write compiled documents to .db file format
     * @param {Object} documents - Object with all documents keyed by their database keys
     * @param {string} packName - Name of the pack
     */
    async writeCompiledDatabase(documents, packName) {
        const dbPath = path.join(process.cwd(), "packs", `${packName}.db`);
        
        try {
            // The documents object is already in the correct format - just write it as JSON
            const dbContent = JSON.stringify(documents, null, 2);
            
            // Write to the .db file
            await fs.writeFile(dbPath, dbContent, 'utf8');
            
            const documentCount = Object.keys(documents).length;
            console.log(`Successfully compiled ${documentCount} documents to ${dbPath}`);
            
        } catch (error) {
            console.error(`Error writing compiled database: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if a directory exists
     * @param {string} dirPath - Directory path to check
     * @returns {boolean} - True if directory exists
     */
    async directoryExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
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
  compile                 Compile individual JSON files back into a .db file
  help                    Show this help message

Options:
  --pack <name>          Specify pack name (actors, items, macros, rollTables)
  --file <path>          Specify custom .db file path (extract only)
  --help                 Show help

Examples:
  node "scripts/build/dbConvert.mjs" extract --pack actors
  node "scripts/build/dbConvert.mjs" extract --file ./packs/actors.db
  node "scripts/build/dbConvert.mjs" compile --pack actors
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
                case 'compile':
                    await this.handleCompile();
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
        const customFile = this.options.file;

        // If a custom file is specified, extract just that file
        if (customFile) {
            const converter = new dbConvert('actors'); // Default pack name for custom file
            await converter.extract(customFile);
            return;
        }

        // If no pack is specified, extract all available packs
        if (!this.options.pack) {
            console.log('No pack specified, extracting all available packs...\n');
            
            for (const packName of dbConvert.AVAILABLE_PACKS) {
                console.log(`Extracting ${packName}...`);
                const converter = new dbConvert(packName);
                
                try {
                    await converter.extract();
                    console.log(`✓ Successfully extracted ${packName}\n`);
                } catch (error) {
                    console.error(`✗ Failed to extract ${packName}: ${error.message}\n`);
                }
            }
            return;
        }

        // Extract specific pack
        const packName = this.options.pack;
        const converter = new dbConvert(packName);
        await converter.extract();
    }

    /**
     * Handle the compile command
     */
    async handleCompile() {
        // If no pack is specified, compile all available packs
        if (!this.options.pack) {
            console.log('No pack specified, compiling all available packs...\n');
            
            for (const packName of dbConvert.AVAILABLE_PACKS) {
                console.log(`Compiling ${packName}...`);
                const converter = new dbConvert(packName);
                
                try {
                    await converter.compile(packName);
                    console.log(`✓ Successfully compiled ${packName}\n`);
                } catch (error) {
                    console.error(`✗ Failed to compile ${packName}: ${error.message}\n`);
                }
            }
            return;
        }

        // Compile specific pack
        const packName = this.options.pack;
        const converter = new dbConvert(packName);
        await converter.compile(packName);
    }
}

// Export classes
export { dbConvert, dbConvertCLI };

// CLI runner - only run if this file is executed directly
if (process.argv && process.argv.length > 2) {
    const cli = new dbConvertCLI();
    cli.run();
}