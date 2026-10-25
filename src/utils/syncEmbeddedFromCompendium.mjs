const { DialogV2 } = foundry.applications.api;

const PACK_ID = "fade-compendiums.item-compendium";
const ITEM_TYPES = ["spell", "specialAbility", "skill", "weaponMastery"];

/**
 * Refresh actor-embedded item definitions from fade-compendiums, preserving state fields.
 */
export class SyncEmbeddedFromCompendium {
   static register() {
      const mod = game.modules.get("fade-compendiums");
      if (!mod) return;
      mod.api = mod.api ?? {};
      mod.api.syncEmbeddedFromCompendium = () => SyncEmbeddedFromCompendium.promptAndRun();
   }

   /**
    * Show type checkboxes, then sync selected types on all world actors.
    */
   static async promptAndRun() {
      if (!game.user.isGM) {
         ui.notifications.warn(game.i18n.localize("FADEPACK.SyncEmbedded.gmOnly"));
         return;
      }

      const content = `
         <p>${game.i18n.localize("FADEPACK.SyncEmbedded.hint")}</p>
         <form class="flexcol">
            ${ITEM_TYPES.map((type) => `
               <div class="form-group">
                  <label class="checkbox">
                     <input type="checkbox" name="type-${type}" checked />
                     ${game.i18n.localize(`TYPES.Item.${type}`)}
                  </label>
               </div>
            `).join("")}
         </form>
      `;

      const confirmed = await DialogV2.wait({
         window: { title: game.i18n.localize("FADEPACK.SyncEmbedded.title") },
         content,
         modal: true,
         rejectClose: false,
         position: { width: 420 },
         buttons: [
            {
               action: "update",
               label: game.i18n.localize("FADEPACK.SyncEmbedded.update"),
               default: true,
               callback: (_event, button) => {
                  const checked = new Set(
                     [...button.form.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.name.replace(/^type-/, ""))
                  );
                  return ITEM_TYPES.filter((type) => checked.has(type));
               },
            },
            {
               action: "cancel",
               label: game.i18n.localize("FADE.dialog.cancel"),
               callback: () => null,
            },
         ],
         close: () => null,
         classes: ["fantastic-depths"],
      });

      if (!confirmed?.length) return;
      await SyncEmbeddedFromCompendium.#run(confirmed);
   }

   static async #run(types) {
      const pack = game.packs.get(PACK_ID);
      if (!pack) {
         ui.notifications.error(game.i18n.format("FADEPACK.SyncEmbedded.packMissing", { pack: PACK_ID }));
         return;
      }

      ui.notifications.info(game.i18n.localize("FADEPACK.SyncEmbedded.working"));

      const index = await pack.getIndex({ fields: ["name", "type"] });
      const byId = new Map();
      const byTypeName = new Map();
      for (const entry of index) {
         if (!types.includes(entry.type)) continue;
         byId.set(entry._id, entry);
         byTypeName.set(`${entry.type}::${entry.name}`, entry);
      }

      const sourceCache = new Map();
      const getSource = async (entry) => {
         if (!entry) return null;
         if (sourceCache.has(entry._id)) return sourceCache.get(entry._id);
         const doc = await pack.getDocument(entry._id);
         sourceCache.set(entry._id, doc);
         return doc;
      };

      let updated = 0;
      let skipped = 0;
      let missing = 0;

      for (const actor of game.actors.contents) {
         const updates = [];
         const effectJobs = [];

         for (const item of actor.items) {
            if (!types.includes(item.type)) continue;

            const source = await SyncEmbeddedFromCompendium.#resolveSource(item, byId, byTypeName, getSource);
            if (!source) {
               missing++;
               continue;
            }

            const payload = SyncEmbeddedFromCompendium.#buildUpdate(item, source);
            if (!payload) {
               skipped++;
               continue;
            }

            updates.push(payload.update);
            if (payload.replaceEffects) {
               effectJobs.push({ item, source });
            }
         }

         if (updates.length) {
            await actor.updateEmbeddedDocuments("Item", updates);
            updated += updates.length;
         }

         for (const { item, source } of effectJobs) {
            await SyncEmbeddedFromCompendium.#replaceEffects(item, source);
         }
      }

      ui.notifications.info(
         game.i18n.format("FADEPACK.SyncEmbedded.done", { updated, missing, skipped })
      );
   }

   static async #resolveSource(item, byId, byTypeName, getSource) {
      const sourceUuid = item._stats?.compendiumSource || item.flags?.core?.sourceId || null;
      if (sourceUuid) {
         try {
            const linked = await fromUuid(sourceUuid);
            if (linked && linked.type === item.type) return linked;
         } catch {
            // Fall through to index lookup.
         }
      }

      if (byId.has(item.id)) {
         return getSource(byId.get(item.id));
      }

      const byName = byTypeName.get(`${item.type}::${item.name}`);
      if (byName) return getSource(byName);

      return null;
   }

   /**
    * @returns {{ update: object, replaceEffects: boolean } | null}
    */
   static #buildUpdate(item, source) {
      const system = foundry.utils.deepClone(source.system ?? {});

      if (item.type === "spell") {
         system.cast = item.system.cast;
         system.memorized = item.system.memorized;
      } else if (item.type === "specialAbility") {
         system.quantity = item.system.quantity;
      } else if (item.type === "skill") {
         system.level = item.system.level;
      }

      const notes = item.system?.gm?.notes;
      if (notes != null && String(notes).trim() !== "") {
         system.gm = system.gm ?? {};
         system.gm.notes = notes;
      }

      return {
         update: {
            _id: item.id,
            name: source.name,
            img: source.img,
            system,
         },
         replaceEffects: true,
      };
   }

   static async #replaceEffects(item, source) {
      const existingIds = item.effects.map((e) => e.id);
      if (existingIds.length) {
         await item.deleteEmbeddedDocuments("ActiveEffect", existingIds);
      }

      const effectData = [...source.effects].map((effect) => {
         const data = effect.toObject();
         delete data._id;
         return data;
      });
      if (effectData.length) {
         await item.createEmbeddedDocuments("ActiveEffect", effectData);
      }
   }
}
