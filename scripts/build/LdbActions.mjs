import { Level } from "level";
import fs from "fs/promises";
import path from "path";

/**
 * LevelDB Pack Manager - ES6 Class for managing FoundryVTT pack data
 */
class LdbActions {
    static AVAILABLE_PACKS = ["actors", "items", "macros", "rollTables", "journals", "scenes"];
    static BACKUP_SUFFIX = ".bak";

    constructor(packName = "rollTables") {
        this.validatePackName(packName);
        this.packName = packName;
        this.paths = this.getPackPaths(packName);
    }

    /**
     * Validate pack name against available packs
     */
    validatePackName(packName) {
        if (!LdbActions.AVAILABLE_PACKS.includes(packName)) {
            throw new Error(`Invalid pack name: ${packName}. Available packs: ${LdbActions.AVAILABLE_PACKS.join(", ")}`);
        }
    }

    /**
     * Get pack paths for the current pack
     */
    getPackPaths(packName) {
        const packDir = path.join(process.cwd(), "packs", packName);
        const outFile = path.join(process.cwd(), "packs", `${packName}.db`);
        return { packDir, outFile };
    }

    /**
     * Export pack data to JSON file
     */
    async dump() {
        const { packDir, outFile } = this.paths;

        // Clean existing .db file if it exists
        try {
            await fs.unlink(outFile);
            console.log(`Cleaned existing file: ${outFile}`);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.warn(`Warning: Could not clean existing file ${outFile}:`, err.message);
            }
        }

        const db = new Level(packDir, { valueEncoding: "utf8" });
        const out = {};

        for await (const [key, value] of db.iterator()) {
            try {
                out[key] = JSON.parse(value);
            } catch (e) {
                console.error("JSON parse error for key", key, ":", e);
                out[key] = value; // Store as string if JSON parse fails
            }
        }

        await fs.writeFile(outFile, JSON.stringify(out, null, 2), "utf8");
        console.log("Wrote", Object.keys(out).length, "entries to", outFile);
        await db.close();
    }

    /**
     * Import pack data from JSON file
     */
    async restore(options = {}) {
        const { backupExisting = false } = options;
        const { packDir, outFile } = this.paths;

        // Read JSON file
        const raw = await fs.readFile(outFile, "utf8");
        const cleanRaw = this.removeBOM(raw);
        const data = JSON.parse(cleanRaw);

        // Handle both old array format and new object format
        let entries;
        if (Array.isArray(data)) {
            // Old format - convert to key-value pairs
            entries = {};
            for (const obj of data) {
                const key = obj._id ?? obj.id;
                if (key) {
                    entries[key] = obj;
                }
            }
        } else if (typeof data === 'object') {
            // New format - already key-value pairs
            entries = data;
        } else {
            throw new Error("Expected an array or object in the .db JSON file");
        }

        // Optional backup of existing pack directory
        if (backupExisting) {
            await this.createBackup(packDir);
        }

        // Ensure pack directory exists
        await fs.mkdir(path.dirname(packDir), { recursive: true });

        // Open Level store and write entries
        const db = new Level(packDir, { valueEncoding: "utf8" });
        let written = 0;

        try {
            for (const [key, value] of Object.entries(entries)) {
                const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                await db.put(key, valueStr);
                written++;
            }
            console.log(`Wrote ${written} entries to Level store at ${packDir}`);
        } finally {
            await db.close();
        }
    }

    /**
     * Create backup of existing pack directory
     */
    async createBackup(packDir) {
        try {
            const stat = await fs.stat(packDir);
            if (stat.isDirectory()) {
                const backupDir = `${packDir}${LdbActions.BACKUP_SUFFIX}-${Date.now()}`;
                await fs.rename(packDir, backupDir);
                console.log("Backed up existing pack directory to", backupDir);
            }
        } catch (err) {
            if (err.code !== "ENOENT") throw err; // ignore if no existing pack
        }
    }

    /**
     * Show sample keys from pack
     */
    async checkpack() {
        const { packDir } = this.paths;
        const db = new Level(packDir, { valueEncoding: 'utf8' });
        let n = 0;

        for await (const [key] of db.iterator()) {
            console.log(key);
            n++;
            if (n >= 20) break;
        }

        console.log('sampled keys:', n);
        await db.close();
    }

    /**
     * Remove BOM (Byte Order Mark) from file content
     * @param {string} content - The file content that may contain BOM
     * @returns {string} - Content with BOM removed
     */
    removeBOM(content) {
        // Check for UTF-8 BOM (EF BB BF) which appears as \uFEFF in JavaScript strings
        if (content.charCodeAt(0) === 0xFEFF) {
            return content.slice(1);
        }
        return content;
    }

    /**
     * List all available packs and their status
     */
    static async listPacks() {
        console.log("Available packs:");
        for (const packName of LdbActions.AVAILABLE_PACKS) {
            const packDir = path.join(process.cwd(), "packs", packName);
            try {
                const stat = await fs.stat(packDir);
                if (stat.isDirectory()) {
                    console.log(`  ✓ ${packName} (exists)`);
                }
            } catch (err) {
                console.log(`  ✗ ${packName} (not found)`);
            }
        }
    }

    /**
     * Dump all available packs
     */
    static async dumpAll() {
        console.log("Dumping all available packs...");
        let successCount = 0;
        let errorCount = 0;

        for (const packName of LdbActions.AVAILABLE_PACKS) {
            try {
                console.log(`\n--- Dumping ${packName} ---`);
                const ldbActions = new LdbActions(packName);
                await ldbActions.dump();
                successCount++;
            } catch (err) {
                console.error(`Error dumping ${packName}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Successfully dumped: ${successCount} packs`);
        if (errorCount > 0) {
            console.log(`Failed to dump: ${errorCount} packs`);
        }
    }

    /**
     * Restore all available packs from their JSON files
     */
    static async restoreAll(options = {}) {
        console.log("Restoring all available packs...");

        let successCount = 0;
        let errorCount = 0;

        for (const packName of LdbActions.AVAILABLE_PACKS) {
            try {
                console.log(`\n--- Restoring ${packName} ---`);
                const ldbActions = new LdbActions(packName);
                await ldbActions.restore(options);
                successCount++;
            } catch (err) {
                console.error(`Error restoring ${packName}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Successfully restored: ${successCount} packs`);
        if (errorCount > 0) {
            console.log(`Failed to restore: ${errorCount} packs`);
        }
    }
}

/**
 * Command Line Interface Runner
 */
class LdbDumpCLI {
    constructor() {
        this.args = process.argv.slice(2);
    }

    /**
     * Parse command line arguments
     */
    parseArgs() {
        const command = this.args[0];
        let packName = "rollTables"; // default
        let backup = false; // default to no backup since git is used
        let packSpecified = false; // track if pack was explicitly specified

        // Look for --pack argument
        const packIndex = this.args.indexOf("--pack");
        if (packIndex !== -1 && packIndex + 1 < this.args.length) {
            packName = this.args[packIndex + 1];
            packSpecified = true;
        }

        // Look for --backup flag
        if (this.args.includes("--backup")) {
            backup = true;
        }

        return { command, packName, backup, packSpecified };
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log(`
Usage: node scripts/build/LdbActions.mjs <command> [--pack <packName>] [--backup]

Commands:
  dump      - Export pack data to JSON file
              If no --pack is specified, dumps all available packs
  restore   - Import pack data from JSON file
              If no --pack is specified, restores all available packs
  checkpack - Show sample keys from pack
  list      - List all available packs
  help      - Show this help message

Options:
  --pack <name>  - Specify pack name (default for checkpack: rollTables)
                   Available: ${LdbActions.AVAILABLE_PACKS.join(", ")}
                   For dump/restore commands: omit to process all packs
  --backup       - Create backup directory before restore (default: false)
                   Use this if you're not using git or want extra safety

Examples:
  node scripts/build/LdbActions.mjs dump                          # Dump all packs
  node scripts/build/LdbActions.mjs dump --pack actors            # Dump specific pack
  node scripts/build/LdbActions.mjs restore                       # Restore all packs
  node scripts/build/LdbActions.mjs restore --pack items          # Restore specific pack
  node scripts/build/LdbActions.mjs restore --pack items --backup
  node scripts/build/LdbActions.mjs checkpack --pack macros
  node scripts/build/LdbActions.mjs list
`);
    }

    /**
     * Execute the CLI command
     */
    async run() {
        try {
            const { command, packName, backup, packSpecified } = this.parseArgs();

            if (command === "dump") {
                if (!packSpecified) {
                    // No --pack argument provided, dump all packs
                    await LdbActions.dumpAll();
                } else {
                    // Specific pack requested
                    const ldbActions = new LdbActions(packName);
                    await ldbActions.dump();
                }
            } else if (command === "restore") {
                if (!packSpecified) {
                    // No --pack argument provided, restore all packs
                    await LdbActions.restoreAll({ backupExisting: backup });
                } else {
                    // Specific pack requested
                    const ldbActions = new LdbActions(packName);
                    await ldbActions.restore({ backupExisting: backup });
                }
            } else if (command === "checkpack") {
                const ldbActions = new LdbActions(packName);
                await ldbActions.checkpack();
            } else if (command === "list") {
                await LdbActions.listPacks();
            } else if (command === "help" || command === "--help" || command === "-h") {
                this.showHelp();
            } else {
                console.error(`Unknown command: ${command}`);
                this.showHelp();
                process.exit(1);
            }
        } catch (err) {
            console.error("Error:", err.message);
            this.showHelp();
            process.exit(1);
        }
    }
}

// Export the classes for potential module usage
export { LdbActions, LdbDumpCLI };

// CLI runner - only execute if this file is run directly
if (process.argv && process.argv.length > 2) {
    const cli = new LdbDumpCLI();
    cli.run();
}
