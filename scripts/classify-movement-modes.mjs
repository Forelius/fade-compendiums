/**
 * Classify remaining packsrc actor movement.modes primary/secondary →
 * ground | fly | water | burrow | web (plus dual combos).
 *
 * Usage:
 *   node scripts/classify-movement-modes.mjs [--dry-run] [packsrcRoot...]
 * Default root: packsrc/actors
 */
import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const roots = process.argv.slice(2).filter((a) => a !== "--dry-run");
if (roots.length === 0) roots.push("packsrc/actors");

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

function derivedFromBase(base) {
   return {
      base,
      turn: base,
      round: Math.floor(base / 3),
      day: Math.floor(base / 5),
      run: base,
   };
}

function cloneMode(mode, action) {
   return {
      action,
      base: mode.base,
      turn: mode.turn,
      round: mode.round,
      day: mode.day,
      run: mode.run,
   };
}

function fillDerivedIfNeeded(mode) {
   const base = Number(mode.base) || 0;
   if (base <= 0) return;
   const zeros = [mode.turn, mode.round, mode.day, mode.run].every(
      (v) => v == null || v === 0
   );
   if (!zeros) return;
   Object.assign(mode, derivedFromBase(base));
}

function hasLegacyActions(modes) {
   return modes.some((m) => m.action === "primary" || m.action === "secondary");
}

function isPlaneActor(file, data) {
   const rel = file.replace(/\\/g, "/");
   if (/Plane_of_/i.test(rel)) return true;
   if (/Plane of /i.test(data.name || "")) return true;
   return false;
}

function embeddedNames(data) {
   return (data.embedded || []).map((i) => i.name).filter(Boolean);
}

function hasFlight(names) {
   return names.some((n) => n === "Flight" || n === "Flying");
}

function hasSwim(names) {
   return names.some((n) => n === "Swim");
}

function basename(file) {
   return path.basename(file);
}

/**
 * @returns {{ bucket: string, changed: boolean } | null}
 * null = skip (no movement / already done / no legacy)
 */
function classify(file, data) {
   const movement = data.system?.movement;
   if (!movement || !Array.isArray(movement.modes)) return null;
   const modes = movement.modes;
   if (!hasLegacyActions(modes)) return null;

   if (isPlaneActor(file, data)) {
      return { bucket: "leave_primary", changed: false };
   }

   const baseName = basename(file);
   const names = embeddedNames(data);

   // --- Locked overrides ---
   if (/Nightcrawler/i.test(baseName) || baseName === "Purple_Worm.json" || baseName === "Caecilia.json") {
      const src = modes[0];
      movement.modes = [cloneMode(src, "ground"), cloneMode(src, "burrow")];
      return { bucket: "ground+burrow", changed: true };
   }

   if (baseName === "Ferret,_Giant.json") {
      for (const mode of modes) mode.action = "ground";
      return { bucket: "ground", changed: true };
   }

   if (baseName === "Lizard,_Draco.json" || baseName === "Phoenix,_Greater.json") {
      for (const mode of modes) {
         if (mode.action === "primary") mode.action = "ground";
         else if (mode.action === "secondary") {
            mode.action = "fly";
            fillDerivedIfNeeded(mode);
         }
      }
      return { bucket: "ground+fly", changed: true };
   }

   if (baseName === "Spider,_Giant_Black_Widow.json") {
      for (const mode of modes) {
         if (mode.action === "primary") mode.action = "ground";
         else if (mode.action === "secondary") {
            mode.action = "web";
            fillDerivedIfNeeded(mode);
         }
      }
      return { bucket: "ground+web", changed: true };
   }

   if (baseName === "Bee,_Giant.json") {
      const speed = derivedFromBase(150);
      speed.round = 50; // 150/50 as specified
      speed.day = 30;
      movement.modes = [{ action: "fly", ...speed }];
      return { bucket: "fly", changed: true };
   }

   if (baseName === "Crab,_Giant.json") {
      for (const mode of modes) mode.action = "ground";
      return { bucket: "ground", changed: true };
   }

   if (baseName === "Leech,_Giant.json") {
      const src = modes[0];
      movement.modes = [cloneMode(src, "ground"), cloneMode(src, "water")];
      return { bucket: "ground+water", changed: true };
   }

   // --- Generic tree ---
   const dual = modes.length >= 2;

   if (dual) {
      if (hasFlight(names) && !hasSwim(names)) {
         for (const mode of modes) {
            if (mode.action === "primary") mode.action = "ground";
            else if (mode.action === "secondary") {
               mode.action = "fly";
               fillDerivedIfNeeded(mode);
            }
         }
         return { bucket: "ground+fly", changed: true };
      }
      if (hasSwim(names) && !hasFlight(names)) {
         for (const mode of modes) {
            if (mode.action === "primary") mode.action = "ground";
            else if (mode.action === "secondary") {
               mode.action = "water";
               fillDerivedIfNeeded(mode);
            }
         }
         return { bucket: "ground+water", changed: true };
      }
      return { bucket: "review_unhandled", changed: false };
   }

   // single mode
   if (hasFlight(names)) {
      for (const mode of modes) mode.action = "fly";
      return { bucket: "fly", changed: true };
   }
   if (hasSwim(names)) {
      for (const mode of modes) mode.action = "water";
      return { bucket: "water", changed: true };
   }

   // Siege + default
   for (const mode of modes) mode.action = "ground";
   return { bucket: "ground", changed: true };
}

function processRoot(root) {
   const files = walkJsonFiles(path.resolve(root));
   const buckets = new Map();
   let changed = 0;
   let skipped = 0;
   let errors = 0;
   const samples = [];

   for (const file of files) {
      try {
         const raw = fs.readFileSync(file, "utf8");
         const data = JSON.parse(raw);
         if (!data.system) {
            skipped++;
            continue;
         }
         const result = classify(file, data);
         if (!result) {
            skipped++;
            continue;
         }
         const list = buckets.get(result.bucket) || [];
         list.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
         buckets.set(result.bucket, list);

         if (result.changed) {
            changed++;
            if (!DRY_RUN) {
               fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
            }
            if (samples.length < 30) {
               const modes = data.system.movement.modes.map(
                  (m) => `${m.action}:${m.base}/${m.round}`
               );
               samples.push(`${path.basename(file)} => ${modes.join(", ")}`);
            }
         }
      } catch (err) {
         errors++;
         console.error(`Error ${file}:`, err.message);
      }
   }

   console.log(`\n=== ${root} ${DRY_RUN ? "(dry-run)" : "(write)"} ===`);
   console.log(`changed=${changed} skipped=${skipped} errors=${errors} total=${files.length}`);
   for (const [bucket, list] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${bucket}: ${list.length}`);
   }
   if (buckets.get("review_unhandled")?.length) {
      console.log("\nUnhandled:");
      for (const f of buckets.get("review_unhandled")) console.log(`  ${f}`);
   }
   if (buckets.get("leave_primary")?.length) {
      console.log("\nLeft primary:");
      for (const f of buckets.get("leave_primary")) console.log(`  ${f}`);
   }
   console.log("\nSample changes:");
   for (const s of samples) console.log(`  ${s}`);
}

for (const root of roots) processRoot(root);
