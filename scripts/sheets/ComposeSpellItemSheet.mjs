import { createComposeItemSheet } from "./composeSheetMixin.mjs";

/**
 * @param {typeof foundry.applications.api.DocumentSheet} Base game.fade.sheets.SpellItemSheet
 * @returns {typeof foundry.applications.api.DocumentSheet}
 */
export function createComposeSpellItemSheet(Base) {
   return createComposeItemSheet(Base);
}
