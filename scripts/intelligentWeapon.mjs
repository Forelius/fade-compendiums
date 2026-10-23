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
            if (!game.user.isGM || !IntelligentWeapon.isEnabled(this.item)) return;
            const parts = options.parts;
            if (!parts.includes("intelligent")) {
               const idx = parts.indexOf("attributes");
               if (idx >= 0) parts.splice(idx + 1, 0, "intelligent");
               else parts.push("intelligent");
            }
         }

         async _prepareContext(options) {
            const context = await super._prepareContext(options);
            const intelligent = IntelligentWeapon.get(this.item);
            context.intelligent = intelligent;
            context.intelligentWillPower = IntelligentWeapon.willPower(this.item);
            context.intelligentLanguages = Array.isArray(intelligent.languages)
               ? intelligent.languages.join(", ")
               : "";
            context.communicationOptions = {
               "": game.i18n.localize("FADEPACK.IntelligentWeapon.communicationNone"),
               empathy: game.i18n.localize("FADEPACK.IntelligentWeapon.empathy"),
               speech: game.i18n.localize("FADEPACK.IntelligentWeapon.speech")
            };
            context.alignmentOptions = {
               "": game.i18n.localize("FADEPACK.IntelligentWeapon.alignmentNone"),
               lawful: game.i18n.localize("FADEPACK.IntelligentWeapon.lawful"),
               neutral: game.i18n.localize("FADEPACK.IntelligentWeapon.neutral"),
               chaotic: game.i18n.localize("FADEPACK.IntelligentWeapon.chaotic")
            };

            if (game.user.isGM && intelligent.enabled) {
               const group = "primary";
               const active = this.tabGroups[group] === "intelligent";
               const intelTab = {
                  id: "intelligent",
                  group,
                  label: "FADE.Actor.Abilities.int.long",
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
               context.intelligent = IntelligentWeapon.get(this.item);
               context.intelligentWillPower = IntelligentWeapon.willPower(this.item);
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

            const current = IntelligentWeapon.get(this.item);
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
         label: "FADEPACK.SheetLabel.IntelligentWeaponItem"
      });

      game.fade.sheets.IntelligentWeaponItemSheet = IntelligentWeaponItemSheet;
   }
}
