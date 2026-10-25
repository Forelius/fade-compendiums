import { createComposeSpellItemSheet } from "../sheets/ComposeSpellItemSheet.mjs";
import { createComposeSpecialAbilitySheet } from "../sheets/ComposeSpecialAbilitySheet.mjs";

const MODULE_ID = "fade-compendiums";

/**
 * Register spell / SA sheet subclasses with Compose tab.
 */
export class ComposeSheets {
   static register() {
      const spellBase = game.fade?.sheets?.SpellItemSheet;
      const saBase = game.fade?.sheets?.SpecialAbilitySheet;
      const gItems = foundry.documents.collections.Items;

      if (spellBase) {
         const ComposeSpellItemSheet = createComposeSpellItemSheet(spellBase);
         gItems.unregisterSheet("fantastic-depths", spellBase, { types: ["spell"] });
         gItems.registerSheet(MODULE_ID, ComposeSpellItemSheet, {
            types: ["spell"],
            makeDefault: true,
            label: "FADEPACK.SheetLabel.ComposeSpellItem"
         });
         game.fade.sheets.ComposeSpellItemSheet = ComposeSpellItemSheet;
      } else {
         console.error("FADEPACK: game.fade.sheets.SpellItemSheet is missing; compose spell sheet not registered.");
      }

      if (saBase) {
         const ComposeSpecialAbilitySheet = createComposeSpecialAbilitySheet(saBase);
         gItems.unregisterSheet("fantastic-depths", saBase, { types: ["specialAbility"] });
         gItems.registerSheet(MODULE_ID, ComposeSpecialAbilitySheet, {
            types: ["specialAbility"],
            makeDefault: true,
            label: "FADEPACK.SheetLabel.ComposeSpecialAbility"
         });
         game.fade.sheets.ComposeSpecialAbilitySheet = ComposeSpecialAbilitySheet;
      } else {
         console.error("FADEPACK: game.fade.sheets.SpecialAbilitySheet is missing; compose SA sheet not registered.");
      }
   }
}
