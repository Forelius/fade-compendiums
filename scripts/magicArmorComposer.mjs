const PACK = "Compendium.fade-compendiums.item-compendium.Item";

/** ActiveEffect name for a magical armor bonus or penalty, such as Armor+2. */
const ARMOR_BONUS_EFFECT = /^Armor[+-]\d+$/;

/**
 * Armor powers the composer can attach. Stock armor has no power.
 * Spell powers link through system.spells. Special abilities link through system.specialAbilities.
 * @type {Array<{id: string, label: string, kind: "spell"|"specialAbility", uuid: string, docName: string, action: string, castAs?: string, charges?: number, forbidCurse?: boolean, summary: string}>}
 */
const ARMOR_POWERS = [
   {
      id: "absorption",
      label: "Absorption",
      kind: "specialAbility",
      uuid: `${PACK}.hpdvqgxVZlVolPam`,
      docName: "Absorption",
      action: "use",
      summary: "Energy drain strikes the armor instead of the wearer. Each level absorbed lowers the magical bonus by 1. At +0 the armor is no longer magical. Track this manually."
   },
   {
      id: "charm",
      label: "Charm",
      kind: "specialAbility",
      uuid: `${PACK}.uz8qiLITjPPfR0lp`,
      docName: "Charm",
      action: "use",
      summary: "A creature that hits the wearer in melee saves vs. spells at +4 or is charmed (charm person or charm monster). Only one successful charm per day. The hit and the save are manual."
   },
   {
      id: "cureWounds",
      label: "Cure Wounds",
      kind: "specialAbility",
      uuid: `${PACK}.MUoGHFs2tmE5eAq8`,
      docName: "Cure Wounds",
      action: "use",
      summary: "Once per day, heals the wearer for half the damage of the blow just received. There is no fixed heal formula."
   },
   {
      id: "electricity",
      label: "Electricity",
      kind: "specialAbility",
      uuid: `${PACK}.PsqXkOiHKlHWvTxC`,
      docName: "Electricity",
      action: "use",
      summary: "Once per day the wearer can charge the armor. The next melee hit against the wearer deals 6d6 and spends the charge. Charging and which blow discharges it are manual."
   },
   {
      id: "energyDrain",
      label: "Energy Drain",
      kind: "specialAbility",
      uuid: `${PACK}.o0dqrlmm9LcxwTpe`,
      docName: "Energy Drain",
      action: "use",
      summary: "Once per day the wearer can charge the armor. The next melee hit against the wearer drains one level. Charging and the drain are manual."
   },
   {
      id: "ethereality",
      label: "Ethereality",
      kind: "spell",
      uuid: `${PACK}.t8nO1MW5J5bAsrt6`,
      docName: "Ethereality (Armor)",
      action: "use",
      summary: "Two command words, each once per day: become ethereal, or return. The wearer may remain ethereal as long as desired."
   },
   {
      id: "fly",
      label: "Fly",
      kind: "spell",
      uuid: `${PACK}.7uUUbcFPAjPYQS0c`,
      docName: "Fly (Armor)",
      action: "use",
      summary: "On command, the wearer flies for 12 turns."
   },
   {
      id: "gaseousForm",
      label: "Gaseous Form",
      kind: "spell",
      uuid: `${PACK}.Vb3hvHI0RWyJ3TkI`,
      docName: "Gaseous Form (Armor)",
      action: "use",
      summary: "On command, the wearer and all equipment carried become gaseous for up to 6 turns."
   },
   {
      id: "haste",
      label: "Haste",
      kind: "spell",
      uuid: `${PACK}.DKAYO11kzagXJanT`,
      docName: "Haste (Armor)",
      action: "use",
      summary: "Once per day, the wearer is hasted for 1 turn."
   },
   {
      id: "invisibility",
      label: "Invisibility",
      kind: "spell",
      uuid: `${PACK}.27EF3s0bHQkPUXQi`,
      docName: "Invisibility (Armor)",
      action: "use",
      summary: "The wearer can become invisible until they attack or cast a spell. The armor itself can be made invisible three times per day; that does not hide the wearer and is tracked manually."
   },
   {
      id: "reflection",
      label: "Reflection",
      kind: "specialAbility",
      uuid: `${PACK}.2gmwppZJ6W6ivKJU`,
      docName: "Reflection",
      action: "use",
      summary: "Light-based attacks and gaze attacks aimed at the wearer are reflected back at their source. Apply this manually."
   },
   {
      id: "removeCurse",
      label: "Remove Curse",
      kind: "spell",
      uuid: `${PACK}.pADDtGB2RFNc6gXT`,
      docName: "Remove Curse (Armor)",
      action: "none",
      castAs: "C36",
      charges: 3,
      forbidCurse: true,
      summary: "Three charges. Each charge removes one curse from the wearer only, as a 36th-level cleric. This armor cannot be cursed."
   }
];

/**
 * Magic armor is cursed, or it has an Armor+N / Armor-N effect that changes system.mod.
 * Raw system.mod is often 0 because prepareBaseData clears it and the effect reapplies the bonus.
 * @param {Item|null} item
 * @returns {boolean}
 */
export function isMagicArmor(item) {
   if (!item || item.type !== "armor") return false;
   if (item.system?.isCursed === true) return true;
   for (const effect of item.effects ?? []) {
      if (!ARMOR_BONUS_EFFECT.test(effect.name ?? "")) continue;
      const changes = effectChanges(effect);
      if (changes.length === 0 || changes.some((change) => change.key === "system.mod")) return true;
   }
   return false;
}

/**
 * @param {ActiveEffect} effect
 * @returns {Array<{key?: string}>}
 */
function effectChanges(effect) {
   const raw = effect.changes ?? effect.system?.changes ?? [];
   return Array.from(raw);
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
   return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
}

/**
 * @param {Item} item
 * @returns {Promise<string|null>} Power id, "" to add the armor as it is, or null to cancel.
 */
async function promptForPower(item) {
   const { DialogV2 } = foundry.applications.api;
   const options = ['<option value="">None — add as is</option>']
      .concat(ARMOR_POWERS.map((power) => `<option value="${power.id}">${escapeHtml(power.label)}</option>`))
      .join("");
   const choice = await DialogV2.wait({
      window: { title: "Magic Armor" },
      position: { width: 440, height: "auto" },
      rejectClose: false,
      modal: true,
      classes: ["fantastic-depths"],
      content: `<form>
         <p>Add <strong>${escapeHtml(item.name)}</strong> as it is, or attach one special power.</p>
         <div class="form-group">
            <label>Special power</label>
            <select name="power">${options}</select>
         </div>
      </form>`,
      buttons: [
         {
            action: "add",
            label: "Add",
            default: true,
            callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object.power ?? ""
         },
         {
            action: "cancel",
            label: "Cancel",
            callback: () => null
         }
      ],
      close: () => null
   });
   return choice ?? null;
}

/**
 * @param {object} itemData
 * @param {typeof ARMOR_POWERS[number]} power
 */
function applyPower(itemData, power) {
   itemData.system.spells ??= [];
   itemData.system.specialAbilities ??= [];
   const linked = [...itemData.system.spells, ...itemData.system.specialAbilities];
   const suffix = ` of ${power.label}`;
   if (!itemData.name.endsWith(suffix)) itemData.name = `${itemData.name}${suffix}`;
   const marker = `data-armor-power="${power.id}"`;
   if (!String(itemData.system.description ?? "").includes(marker)) {
      const paragraph = `<p ${marker}><strong>Special power: ${escapeHtml(power.label)}.</strong> ${escapeHtml(power.summary)}</p>`;
      itemData.system.description = `${itemData.system.description ?? ""}${paragraph}`;
   }
   if (!linked.some((entry) => entry.uuid === power.uuid)) {
      if (power.kind === "spell") {
         itemData.system.spells.push({
            uuid: power.uuid,
            action: power.action,
            castAs: power.castAs ?? "",
            name: power.docName
         });
      } else {
         itemData.system.specialAbilities.push({
            uuid: power.uuid,
            action: power.action,
            name: power.docName,
            mod: 0
         });
      }
   }
   if (power.charges) {
      itemData.system.charges = power.charges;
      itemData.system.chargesMax = power.charges;
   } else if (!(itemData.system.chargesMax > 0) && itemData.system.chargesMax !== null) {
      // Stock armor stores charges at 0/0. A linked power cannot be used unless charges are unlimited.
      itemData.system.charges = 1;
      itemData.system.chargesMax = null;
   }
   if (power.forbidCurse) itemData.system.isCursed = false;
}

/** Listen for magic armor drops and offer to attach one power. */
export function registerMagicArmorDrop() {
   Hooks.on("fadeDropActorSheet", async (context) => {
      const document = context?.document;
      if (!document || !isMagicArmor(document)) return;
      const actor = context.sheet?.actor;
      // Reordering armor already on this actor stays with the core sort drop.
      if (document.parent?.uuid && actor?.uuid && document.parent.uuid === actor.uuid) return;
      if (!game.user.isGM) return;

      const choice = await promptForPower(document);
      if (choice == null) {
         context.handled = true;
         context.result = false;
         return;
      }

      const itemData = document.toObject();
      const power = ARMOR_POWERS.find((entry) => entry.id === choice);
      if (power) applyPower(itemData, power);
      const created = await context.sheet._moveOrSplitItem(context.event, document, itemData);
      context.handled = true;
      context.result = created ? [created] : false;
   });
}
