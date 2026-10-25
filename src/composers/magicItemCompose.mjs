import { ComposeFlags } from "../utils/composeFlags.mjs";

/**
 * Shared apply helpers for magic weapon / armor / ammo composers.
 * Spells and special abilities stay on separate system arrays.
 */
export class MagicItemCompose {
   /**
    * @param {string} value
    * @returns {string}
    */
   static escapeHtml(value) {
      return String(value)
         .replaceAll("&", "&amp;")
         .replaceAll("<", "&lt;")
         .replaceAll(">", "&gt;")
         .replaceAll('"', "&quot;");
   }

   /**
    * Apply path patches from compose data onto itemData.
    * Paths may be flat dotted keys ("system.mod.rangeMultiplier") or nested objects
    * (Foundry can expand dotted keys when flags are stored/merged).
    * @param {object} itemData
    * @param {{set?: Record<string, unknown>, multiply?: Record<string, number>}} patches
    */
   static applyPatches(itemData, patches) {
      if (!patches) return;
      const setMap = foundry.utils.flattenObject(patches.set ?? {});
      for (const [path, value] of Object.entries(setMap)) {
         foundry.utils.setProperty(itemData, path, value);
      }
      const multiplyMap = foundry.utils.flattenObject(patches.multiply ?? {});
      for (const [path, factor] of Object.entries(multiplyMap)) {
         const n = Number(factor);
         if (!Number.isFinite(n)) continue;
         const current = Number(foundry.utils.getProperty(itemData, path));
         const base = Number.isFinite(current) && current !== 0 ? current : 1;
         foundry.utils.setProperty(itemData, path, base * n);
      }
   }

   /**
    * @param {object} itemData
    * @param {Array<{id: string, toHit?: number, dmg?: number, doubleBonus?: boolean}>} vsGroups
    */
   static applyVsGroups(itemData, vsGroups) {
      if (!vsGroups?.length) return;
      itemData.system.mod ??= {};
      itemData.system.mod.vsGroup ??= {};
      for (const group of vsGroups) {
         if (group.doubleBonus) {
            const base = Math.abs(Number(itemData.system.mod.toHit) || 0);
            itemData.system.mod.vsGroup[group.id] = { toHit: base, dmg: base, special: null };
         } else {
            itemData.system.mod.vsGroup[group.id] = {
               toHit: group.toHit ?? 0,
               dmg: group.dmg ?? 0,
               special: null
            };
         }
      }
   }

   /**
    * Link a spell or SA into itemData and apply compose bake fields.
    *
    * @param {object} itemData Mutable item source
    * @param {Item|object} linkedDoc Resolved spell or specialAbility document (or toObject)
    * @param {object} options
    * @param {string} options.markerAttr e.g. data-weapon-talent="flaming"
    * @param {string} options.nameSuffix I18n-formatted name suffix already resolved
    * @param {string} options.descriptionHtml I18n-formatted description paragraph
    * @param {object} [options.compose] Override compose payload (else read from linkedDoc flags)
    * @param {boolean} [options.defaultUnlimitedCharges] Weapon/armor default when compose does not specify
    * @param {string} [options.entryId] Marker id fragment
    */
   static applyLinkedTalent(itemData, linkedDoc, options = {}) {
      const compose = options.compose ?? ComposeFlags.get(linkedDoc);
      const type = linkedDoc.type ?? linkedDoc.system?.type;
      const uuid = linkedDoc.uuid
         ?? (linkedDoc._id ? `Compendium.fade-compendiums.item-compendium.Item.${linkedDoc._id}` : null);
      const docName = linkedDoc.name ?? compose.docName ?? "Talent";
      const action = compose.action || "use";

      itemData.system.spells ??= [];
      itemData.system.specialAbilities ??= [];

      if (options.nameSuffix) {
         const suffix = options.nameSuffix;
         if (!itemData.name.endsWith(suffix) && !itemData.name.includes(suffix)) {
            itemData.name = `${itemData.name}${suffix}`;
         }
      }

      if (options.markerAttr && options.descriptionHtml) {
         if (!String(itemData.system.description ?? "").includes(options.markerAttr)) {
            itemData.system.description = `${itemData.system.description ?? ""}${options.descriptionHtml}`;
         }
      }

      const linked = [...itemData.system.spells, ...itemData.system.specialAbilities];
      if (uuid && !linked.some((entry) => entry.uuid === uuid)) {
         if (type === "spell") {
            itemData.system.spells.push({
               uuid,
               action,
               castAs: compose.castAs ?? "",
               name: docName,
               cost: compose.cost ?? 1
            });
         } else if (type === "specialAbility") {
            itemData.system.specialAbilities.push({
               uuid,
               action,
               name: docName,
               mod: 0,
               cost: compose.cost ?? 1
            });
         }
      }

      MagicItemCompose.applyVsGroups(itemData, compose.vsGroups);
      MagicItemCompose.applyPatches(itemData, compose.patches);

      if (compose.forbidCurse) itemData.system.isCursed = false;

      if (compose.charges != null && Number(compose.charges) > 0) {
         const n = Number(compose.charges);
         itemData.system.charges = n;
         itemData.system.chargesMax = n;
      } else if (
         compose.unlimitedCharges === true
         || (options.defaultUnlimitedCharges === true && !(itemData.system.chargesMax > 0) && itemData.system.chargesMax !== null)
      ) {
         itemData.system.charges = 1;
         itemData.system.chargesMax = null;
      }
   }

   /**
    * Negate listed numeric paths (and vsGroup toHit/dmg) for curses.
    * @param {object} itemData
    * @param {string[]} paths e.g. system.mod.toHit, system.mod.dmgRanged
    */
   static applyCurseNegate(itemData, paths = []) {
      itemData.system.isCursed = true;
      itemData.system.mod ??= {};
      for (const path of paths) {
         const value = Number(foundry.utils.getProperty(itemData, path)) || 0;
         if (value > 0) foundry.utils.setProperty(itemData, path, -value);
      }
      for (const [groupId, modData] of Object.entries(itemData.system.mod.vsGroup || {})) {
         const hit = Number(modData.toHit) || 0;
         const damage = Number(modData.dmg) || 0;
         if (hit > 0) modData.toHit = -hit;
         if (damage > 0) modData.dmg = -damage;
         itemData.system.mod.vsGroup[groupId] = modData;
      }
   }
}
