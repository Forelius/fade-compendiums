import { createIntelligentWeaponItemSheet } from "./sheets/IntelligentWeaponItemSheet.mjs";

const MODULE_ID = "fade-compendiums";
const FLAG_KEY = "intelligent";

/**
 * Intelligent weapon flags, will-power helpers, and sheet registration.
 * Powers stay on system.specialAbilities / system.spells like other gear.
 */
export class IntelligentWeapon {
   /** Category on sword power special abilities that add +1 will power each. */
   static EXTRAORDINARY_POWER_CATEGORY = "extraordinary-power";
   static PRIMARY_POWER_CATEGORY = "primary-power";

   /**
    * Default intelligent-weapon flag payload (identity / control only).
    * @returns {object}
    */
   static defaults() {
      return {
         enabled: false,
         intelligence: null,
         communication: "",
         languages: [],
         alignment: "",
         ego: null,
         notes: ""
      };
   }

   /**
    * @param {Item|null|undefined} item
    * @returns {object}
    */
   static get(item) {
      const stored = item?.flags?.[MODULE_ID]?.[FLAG_KEY];
      return foundry.utils.mergeObject(IntelligentWeapon.defaults(), stored ?? {}, { inplace: false });
   }

   /**
    * @param {Item|null|undefined} item
    * @returns {boolean}
    */
   static isEnabled(item) {
      return IntelligentWeapon.get(item).enabled === true;
   }

   /**
    * Count linked special abilities whose document category is extraordinary-power.
    * @param {Item|null|undefined} item
    * @returns {number}
    */
   static countExtraordinaryPowers(item) {
      const links = item?.system?.specialAbilities;
      if (!Array.isArray(links) || !links.length) return 0;
      let count = 0;
      for (const link of links) {
         if (!link?.uuid) continue;
         const doc = typeof fromUuidSync === "function" ? fromUuidSync(link.uuid) : null;
         if (doc?.system?.category === IntelligentWeapon.EXTRAORDINARY_POWER_CATEGORY) count += 1;
      }
      return count;
   }

   /**
    * Will power = INT + ego + extraordinary powers linked on the weapon.
    * @param {Item|null|undefined} item
    * @returns {number}
    */
   static willPower(item) {
      const data = IntelligentWeapon.get(item);
      const intelligence = Number(data.intelligence) || 0;
      const ego = Number(data.ego) || 0;
      return intelligence + ego + IntelligentWeapon.countExtraordinaryPowers(item);
   }

   /** Register the intelligent weapon sheet subclass on Items and game.fade.sheets. */
   static register() {
      const Base = game.fade?.sheets?.WeaponItemSheet;
      if (!Base) {
         console.error("FADEPACK: game.fade.sheets.WeaponItemSheet is missing; intelligent weapon sheet not registered.");
         return;
      }

      const IntelligentWeaponItemSheet = createIntelligentWeaponItemSheet(Base);
      const gItems = foundry.documents.collections.Items;
      gItems.unregisterSheet("fantastic-depths", Base, { types: ["weapon"] });
      gItems.registerSheet(MODULE_ID, IntelligentWeaponItemSheet, {
         types: ["weapon"],
         makeDefault: true,
         label: "FADEPACK.SheetLabel.IntelligentWeaponItem"
      });

      game.fade.sheets.IntelligentWeaponItemSheet = IntelligentWeaponItemSheet;
   }
}
