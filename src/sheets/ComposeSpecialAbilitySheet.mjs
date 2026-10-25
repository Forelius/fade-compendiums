import { createComposeItemSheet } from "./composeSheetMixin.mjs";

/**
 * @param {typeof foundry.applications.api.DocumentSheet} Base game.fade.sheets.SpecialAbilitySheet
 * @returns {typeof foundry.applications.api.DocumentSheet}
 */
export function createComposeSpecialAbilitySheet(Base) {
   return createComposeItemSheet(Base);
}
