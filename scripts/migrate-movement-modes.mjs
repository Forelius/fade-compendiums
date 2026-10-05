/**
 * One-shot: convert packsrc actor system.movement / movement2 → movement.modes.
 * Usage: node scripts/migrate-movement-modes.mjs [packsrcRoot...]
 */
import fs from "node:fs";
import path from "node:path";

function isMeaningfulSecondary(legacy) {
   if (!legacy || typeof legacy !== "object") return false;
   const max = legacy.max;
   const turn = Number(legacy.turn) || 0;
   if (typeof max === "number" && max > 0) return true;
   if (max === null) {
      return [legacy.turn, legacy.round, legacy.day, legacy.run].some((v) => v != null && v !== 0);
   }
   return turn > 0;
}

function legacyToMode(legacy, action) {
   return {
      action,
      base: legacy?.max !== undefined ? legacy.max : (action === "primary" ? 120 : 0),
      turn: legacy?.turn ?? null,
      round: legacy?.round ?? null,
      day: legacy?.day ?? null,
      run: legacy?.run ?? null,
   };
}

function stripModeLabels(system) {
   const modes = system?.movement?.modes;
   if (!Array.isArray(modes)) return false;
   let changed = false;
   for (const mode of modes) {
      if (mode && Object.prototype.hasOwnProperty.call(mode, "label")) {
         delete mode.label;
         changed = true;
      }
   }
   return changed;
}

function migrateSystem(system) {
   if (!system || typeof system !== "object") return false;
   const movement = system.movement;
   if (!movement || typeof movement !== "object") return false;

   // Already on modes[]: just drop obsolete per-mode label fields
   if (Array.isArray(movement.modes)) {
      return stripModeLabels(system);
   }

   const hasLegacy = Object.prototype.hasOwnProperty.call(movement, "max")
      || Object.prototype.hasOwnProperty.call(movement, "turn");
   if (!hasLegacy) return false;

   const modes = [legacyToMode(movement, "primary")];
   if (isMeaningfulSecondary(system.movement2)) {
      modes.push(legacyToMode(system.movement2, "secondary"));
   }

   system.movement = {
      modifiers: {
         encumbrance: 1,
         fixedPrimary: null,
      },
      modes,
   };
   delete system.movement2;
   return true;
}

function walkJsonFiles(dir, out = []) {
   if (!fs.existsSync(dir)) return out;
   for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkJsonFiles(full, out);
      else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "_folders.json") {
         out.push(full);
      }
   }
   return out;
}

function migrateRoot(root) {
   const files = walkJsonFiles(root);
   let changed = 0;
   let skipped = 0;
   let errors = 0;
   for (const file of files) {
      try {
         const raw = fs.readFileSync(file, "utf8");
         const data = JSON.parse(raw);
         if (!data.system) {
            skipped++;
            continue;
         }
         if (!migrateSystem(data.system)) {
            skipped++;
            continue;
         }
         // Preserve trailing newline style common in packsrc
         fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
         changed++;
      } catch (err) {
         errors++;
         console.error(`Error ${file}:`, err.message);
      }
   }
   console.log(`${root}: changed=${changed} skipped=${skipped} errors=${errors} total=${files.length}`);
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
   console.error("Pass one or more packsrc roots (e.g. packsrc/actors)");
   process.exit(1);
}
for (const root of roots) {
   migrateRoot(path.resolve(root));
}
