import { IntelligentWeapon } from "../utils/intelligentWeapon.mjs";

const MODULE_ID = "fade-compendiums";
const FLAG_KEY = "intelligent";

/**
 * Build the weapon sheet subclass once FD has exposed WeaponItemSheet.
 * @param {typeof foundry.applications.api.DocumentSheet} Base game.fade.sheets.WeaponItemSheet
 * @returns {typeof foundry.applications.api.DocumentSheet}
 */
export function createIntelligentWeaponItemSheet(Base) {
   return class IntelligentWeaponItemSheet extends Base {
      static PARTS = {
         ...Base.PARTS,
         intelligent: {
            template: "modules/fade-compendiums/templates/item/weapon/intelligent.hbs"
         }
      };

      _configureRenderOptions(options) {
         super._configureRenderOptions(options);
         if (!game.user.isGM) return;
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

         if (game.user.isGM) {
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
         if (partId === "intelligent") {
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

         data.flags ??= {};
         data.flags[MODULE_ID] ??= {};
         data.flags[MODULE_ID][FLAG_KEY] = merged;
         return data;
      }
   };
}
