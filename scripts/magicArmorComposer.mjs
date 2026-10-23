const PACK = "Compendium.fade-compendiums.item-compendium.Item";

/** ActiveEffect name for a magical armor bonus or penalty, such as Armor+2. */
const ARMOR_BONUS_EFFECT = /^Armor[+-]\d+$/;

/**
 * Compose magical armor on actor-sheet drop (as-is or one special power).
 */
export class MagicArmorComposer {
   /**
    * Armor powers the composer can attach. Stock armor has no power.
    * @type {Array<{id: string, kind: "spell"|"specialAbility", uuid: string, docName: string, action: string, castAs?: string, charges?: number, forbidCurse?: boolean}>}
    */
   static ARMOR_POWERS = [
      { id: "absorption", kind: "specialAbility", uuid: `${PACK}.hpdvqgxVZlVolPam`, docName: "Absorption", action: "use" },
      { id: "charm", kind: "specialAbility", uuid: `${PACK}.uz8qiLITjPPfR0lp`, docName: "Charm", action: "use" },
      { id: "cureWounds", kind: "specialAbility", uuid: `${PACK}.MUoGHFs2tmE5eAq8`, docName: "Cure Wounds", action: "use" },
      { id: "electricity", kind: "specialAbility", uuid: `${PACK}.PsqXkOiHKlHWvTxC`, docName: "Electricity", action: "use" },
      { id: "energyDrain", kind: "specialAbility", uuid: `${PACK}.o0dqrlmm9LcxwTpe`, docName: "Energy Drain", action: "use" },
      { id: "ethereality", kind: "spell", uuid: `${PACK}.t8nO1MW5J5bAsrt6`, docName: "Ethereality (Armor)", action: "use" },
      { id: "fly", kind: "spell", uuid: `${PACK}.7uUUbcFPAjPYQS0c`, docName: "Fly (Armor)", action: "use" },
      { id: "gaseousForm", kind: "spell", uuid: `${PACK}.Vb3hvHI0RWyJ3TkI`, docName: "Gaseous Form (Armor)", action: "use" },
      { id: "haste", kind: "spell", uuid: `${PACK}.DKAYO11kzagXJanT`, docName: "Haste (Armor)", action: "use" },
      { id: "invisibility", kind: "spell", uuid: `${PACK}.27EF3s0bHQkPUXQi`, docName: "Invisibility (Armor)", action: "use" },
      { id: "reflection", kind: "specialAbility", uuid: `${PACK}.2gmwppZJ6W6ivKJU`, docName: "Reflection", action: "use" },
      {
         id: "removeCurse",
         kind: "spell",
         uuid: `${PACK}.pADDtGB2RFNc6gXT`,
         docName: "Remove Curse (Armor)",
         action: "none",
         castAs: "C36",
         charges: 3,
         forbidCurse: true
      }
   ];

   /** Listen for magic armor drops and offer to attach one power. */
   static register() {
      const composer = new MagicArmorComposer();
      Hooks.on("fadeDropActorSheet", (context) => composer.onDropActorSheet(context));
   }

   /**
    * Magic armor is cursed, or it has an Armor+N / Armor-N effect that changes system.mod.
    * Raw system.mod is often 0 because prepareBaseData clears it and the effect reapplies the bonus.
    * @param {Item|null} item
    * @returns {boolean}
    */
   static isMagicArmor(item) {
      if (!item || item.type !== "armor") return false;
      if (item.system?.isCursed === true) return true;
      for (const effect of item.effects ?? []) {
         if (!ARMOR_BONUS_EFFECT.test(effect.name ?? "")) continue;
         const changes = MagicArmorComposer.#effectChanges(effect);
         if (changes.length === 0 || changes.some((change) => change.key === "system.mod")) return true;
      }
      return false;
   }

   /**
    * @param {object} context fadeDropActorSheet hook context
    */
   async onDropActorSheet(context) {
      const document = context?.document;
      if (!document || !MagicArmorComposer.isMagicArmor(document)) return;
      const actor = context.sheet?.actor;
      // Reordering armor already on this actor stays with the core sort drop.
      if (document.parent?.uuid && actor?.uuid && document.parent.uuid === actor.uuid) return;
      if (!game.user.isGM) return;

      const choice = await this.#promptForPower(document);
      if (choice == null) {
         context.handled = true;
         context.result = false;
         return;
      }

      const itemData = document.toObject();
      const power = MagicArmorComposer.ARMOR_POWERS.find((entry) => entry.id === choice);
      if (power) this.#applyPower(itemData, power);
      const created = await context.sheet._moveOrSplitItem(context.event, document, itemData);
      context.handled = true;
      context.result = created ? [created] : false;
   }

   /**
    * @param {ActiveEffect} effect
    * @returns {Array<{key?: string}>}
    */
   static #effectChanges(effect) {
      const raw = effect.changes ?? effect.system?.changes ?? [];
      return Array.from(raw);
   }

   /**
    * @param {string} value
    * @returns {string}
    */
   static #escapeHtml(value) {
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
   async #promptForPower(item) {
      const { DialogV2 } = foundry.applications.api;
      const escapeHtml = MagicArmorComposer.#escapeHtml;
      const options = [`<option value="">${escapeHtml(game.i18n.localize("FADEPACK.MagicArmor.powerNone"))}</option>`]
         .concat(MagicArmorComposer.ARMOR_POWERS.map((power) => `<option value="${power.id}">${escapeHtml(power.docName)}</option>`))
         .join("");
      const choice = await DialogV2.wait({
         window: { title: game.i18n.localize("FADEPACK.MagicArmor.title") },
         position: { width: 440, height: "auto" },
         rejectClose: false,
         modal: true,
         classes: ["fantastic-depths"],
         content: `<form>
         <p>${game.i18n.format("FADEPACK.MagicArmor.intro", { name: escapeHtml(item.name) })}</p>
         <div class="form-group">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicArmor.power"))}</label>
            <select name="power">${options}</select>
         </div>
      </form>`,
         buttons: [
            {
               action: "add",
               label: game.i18n.localize("FADEPACK.add"),
               default: true,
               callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object.power ?? ""
            },
            {
               action: "cancel",
               label: game.i18n.localize("FADE.dialog.cancel"),
               callback: () => null
            }
         ],
         close: () => null
      });
      return choice ?? null;
   }

   /**
    * @param {object} itemData
    * @param {typeof MagicArmorComposer.ARMOR_POWERS[number]} power
    */
   #applyPower(itemData, power) {
      itemData.system.spells ??= [];
      itemData.system.specialAbilities ??= [];
      const linked = [...itemData.system.spells, ...itemData.system.specialAbilities];
      const label = power.docName;
      const suffix = game.i18n.format("FADEPACK.MagicArmor.powerNameSuffix", { power: label });
      if (!itemData.name.endsWith(suffix)) itemData.name = `${itemData.name}${suffix}`;
      const marker = `data-armor-power="${power.id}"`;
      if (!String(itemData.system.description ?? "").includes(marker)) {
         const paragraph = game.i18n.format("FADEPACK.MagicArmor.powerDescription", {
            marker,
            power: MagicArmorComposer.#escapeHtml(label)
         });
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
}
