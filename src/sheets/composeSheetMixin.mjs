import { ComposeFlags, COMPOSE_MODULE_ID, COMPOSE_FLAG_KEY, COMPOSE_ROLES } from "../utils/composeFlags.mjs";

/**
 * Shared Compose-tab behavior for spell and special-ability sheet subclasses.
 * @param {typeof foundry.applications.api.DocumentSheet} Base
 * @returns {typeof foundry.applications.api.DocumentSheet}
 */
export function createComposeItemSheet(Base) {
   return class ComposeItemSheet extends Base {
      static PARTS = {
         ...Base.PARTS,
         compose: {
            template: "modules/fade-compendiums/templates/item/compose/compose.hbs"
         }
      };

      _configureRenderOptions(options) {
         super._configureRenderOptions(options);
         if (!game.user.isGM) return;
         const parts = options.parts;
         if (parts.includes("compose")) return;
         const before = parts.indexOf("gmOnly");
         if (before >= 0) parts.splice(before, 0, "compose");
         else parts.push("compose");
      }

      async _prepareContext(options) {
         const context = await super._prepareContext(options);
         context.compose = ComposeFlags.get(this.item);
         context.composeRoleOptions = {
            [COMPOSE_ROLES.NONE]: game.i18n.localize("FADEPACK.Compose.roleNone"),
            [COMPOSE_ROLES.WEAPON_TALENT]: game.i18n.localize("FADEPACK.Compose.roleWeaponTalent"),
            [COMPOSE_ROLES.ARMOR_POWER]: game.i18n.localize("FADEPACK.Compose.roleArmorPower"),
            [COMPOSE_ROLES.MISSILE_TALENT]: game.i18n.localize("FADEPACK.Compose.roleMissileTalent"),
            [COMPOSE_ROLES.INTEL_PRIMARY]: game.i18n.localize("FADEPACK.Compose.roleIntelPrimary"),
            [COMPOSE_ROLES.INTEL_EXTRAORDINARY]: game.i18n.localize("FADEPACK.Compose.roleIntelExtraordinary")
         };

         if (game.user.isGM && context.tabs) {
            const group = "primary";
            const active = this.tabGroups[group] === "compose";
            const composeTab = {
               id: "compose",
               group,
               label: "FADEPACK.Compose.tab",
               active,
               cssClass: active ? "active" : ""
            };
            const tabs = context.tabs;
            const ordered = {};
            for (const [key, tab] of Object.entries(tabs)) {
               if (key === "gmOnly") ordered.compose = composeTab;
               ordered[key] = tab;
            }
            if (!ordered.compose) ordered.compose = composeTab;
            context.tabs = ordered;
         }
         return context;
      }

      async _preparePartContext(partId, context) {
         context = await super._preparePartContext(partId, context);
         if (partId === "compose") {
            context.compose = ComposeFlags.get(this.item);
         }
         return context;
      }

      _prepareSubmitData(event, form, formData) {
         const data = super._prepareSubmitData(event, form, formData);
         const raw = data.flags?.[COMPOSE_MODULE_ID]?.[COMPOSE_FLAG_KEY];
         if (!raw) return data;
         data.flags ??= {};
         data.flags[COMPOSE_MODULE_ID] ??= {};
         data.flags[COMPOSE_MODULE_ID][COMPOSE_FLAG_KEY] = ComposeFlags.normalize(raw);
         return data;
      }
   };
}
