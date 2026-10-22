const MODULE_ID = "fade-compendiums";
const FLAG_KEY = "intelligent";

/** Category on sword power special abilities that add +1 will power each. */
export const EXTRAORDINARY_POWER_CATEGORY = "extraordinary-power";
export const PRIMARY_POWER_CATEGORY = "primary-power";

/**
 * Default intelligent-weapon flag payload (identity / control only).
 * Powers are linked on system.specialAbilities / system.spells like other gear.
 * @returns {object}
 */
export function defaultIntelligentWeapon() {
   return {
      enabled: false,
      intelligence: null,
      communication: "",
      languages: [],
      alignment: "",
      ego: null,
      readMagic: false,
      notes: ""
   };
}

/**
 * @param {Item|null|undefined} item
 * @returns {object}
 */
export function getIntelligentWeapon(item) {
   const stored = item?.flags?.[MODULE_ID]?.[FLAG_KEY];
   return foundry.utils.mergeObject(defaultIntelligentWeapon(), stored ?? {}, { inplace: false });
}

/**
 * @param {Item|null|undefined} item
 * @returns {boolean}
 */
export function hasIntelligentWeapon(item) {
   return getIntelligentWeapon(item).enabled === true;
}

/**
 * Count linked special abilities whose document category is extraordinary-power.
 * @param {Item|null|undefined} item
 * @returns {number}
 */
export function countExtraordinaryPowers(item) {
   const links = item?.system?.specialAbilities;
   if (!Array.isArray(links) || !links.length) return 0;
   let count = 0;
   for (const link of links) {
      if (!link?.uuid) continue;
      const doc = typeof fromUuidSync === "function" ? fromUuidSync(link.uuid) : null;
      if (doc?.system?.category === EXTRAORDINARY_POWER_CATEGORY) count += 1;
   }
   return count;
}

/**
 * Will power = INT + ego + extraordinary powers linked on the weapon.
 * @param {Item|null|undefined} item
 * @returns {number}
 */
export function computeWillPower(item) {
   const data = getIntelligentWeapon(item);
   const intelligence = Number(data.intelligence) || 0;
   const ego = Number(data.ego) || 0;
   return intelligence + ego + countExtraordinaryPowers(item);
}

/**
 * Register the intelligent weapon sheet subclass and helpers on the module.
 */
export function registerIntelligentWeaponSheet() {
   const Base = game.fade?.sheets?.WeaponItemSheet;
   if (!Base) {
      console.error("FADEPACK: game.fade.sheets.WeaponItemSheet is missing; intelligent weapon sheet not registered.");
      return;
   }

   class IntelligentWeaponItemSheet extends Base {
      static PARTS = {
         ...Base.PARTS,
         attributes: {
            template: "modules/fade-compendiums/templates/item/weapon/attributes.hbs"
         },
         intelligent: {
            template: "modules/fade-compendiums/templates/item/weapon/intelligent.hbs"
         }
      };

      _configureRenderOptions(options) {
         super._configureRenderOptions(options);
         if (!game.user.isGM || !hasIntelligentWeapon(this.item)) return;
         const parts = options.parts;
         if (!parts.includes("intelligent")) {
            const idx = parts.indexOf("attributes");
            if (idx >= 0) parts.splice(idx + 1, 0, "intelligent");
            else parts.push("intelligent");
         }
      }

      async _prepareContext(options) {
         const context = await super._prepareContext(options);
         const intelligent = getIntelligentWeapon(this.item);
         context.intelligent = intelligent;
         context.intelligentWillPower = computeWillPower(this.item);
         context.intelligentLanguages = Array.isArray(intelligent.languages)
            ? intelligent.languages.join(", ")
            : "";
         context.communicationOptions = {
            "": "—",
            empathy: "Empathy",
            speech: "Speech"
         };
         context.alignmentOptions = {
            "": "—",
            lawful: "Lawful",
            neutral: "Neutral",
            chaotic: "Chaotic"
         };

         if (game.user.isGM && intelligent.enabled) {
            const group = "primary";
            const active = this.tabGroups[group] === "intelligent";
            const intelTab = {
               id: "intelligent",
               group,
               label: "Intelligence",
               active,
               cssClass: active ? "active" : ""
            };
            const tabs = context.tabs;
            context.tabs = {
               description: tabs.description,
               attributes: tabs.attributes,
               intelligent: intelTab,
               specialAbilities: tabs.specialAbilities,
               effects: tabs.effects,
               gmOnly: tabs.gmOnly
            };
         }
         return context;
      }

      async _preparePartContext(partId, context) {
         context = await super._preparePartContext(partId, context);
         if (partId === "attributes" || partId === "intelligent") {
            context.intelligent = getIntelligentWeapon(this.item);
            context.intelligentWillPower = computeWillPower(this.item);
            context.intelligentLanguages = Array.isArray(context.intelligent.languages)
               ? context.intelligent.languages.join(", ")
               : "";
         }
         return context;
      }

      _prepareSubmitData(event, form, formData) {
         const data = super._prepareSubmitData(event, form, formData);
         const intel = data.flags?.[MODULE_ID]?.[FLAG_KEY];
         if (!intel) return data;

         const current = getIntelligentWeapon(this.item);
         const merged = foundry.utils.mergeObject(current, intel, { inplace: false });

         if (typeof merged.languages === "string") {
            merged.languages = merged.languages
               .split(",")
               .map((entry) => entry.trim())
               .filter((entry) => entry.length > 0);
         }

         data.flags[MODULE_ID][FLAG_KEY] = merged;
         return data;
      }
   }

   const gItems = foundry.documents.collections.Items;
   gItems.unregisterSheet("fantastic-depths", Base, { types: ["weapon"] });
   gItems.registerSheet(MODULE_ID, IntelligentWeaponItemSheet, {
      types: ["weapon"],
      makeDefault: true,
      label: "Intelligent Weapon Sheet"
   });

   game.fade.sheets.IntelligentWeaponItemSheet = IntelligentWeaponItemSheet;
}
