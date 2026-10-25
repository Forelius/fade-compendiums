import { ComposeFlags, COMPOSE_ROLES } from "../utils/composeFlags.mjs";
import { MagicItemCompose } from "./magicItemCompose.mjs";

/** ActiveEffect name for a magical armor bonus or penalty, such as Armor+2. */
const ARMOR_BONUS_EFFECT = /^Armor[+-]\d+$/;

/**
 * Compose magical armor on actor-sheet drop (as-is or one special power).
 * Picker membership comes from flags.fade-compendiums.compose.role === armor-power.
 */
export class MagicArmorComposer {
   static register() {
      const composer = new MagicArmorComposer();
      Hooks.on("fadeDropActorSheet", (context) => composer.onDropActorSheet(context));
   }

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

   async onDropActorSheet(context) {
      const document = context?.document;
      if (!document || !MagicArmorComposer.isMagicArmor(document)) return;
      const actor = context.sheet?.actor;
      if (document.parent?.uuid && actor?.uuid && document.parent.uuid === actor.uuid) return;
      if (!game.user.isGM) return;

      const choice = await this.#promptForPower(document);
      if (choice == null) {
         context.handled = true;
         context.result = false;
         return;
      }

      const itemData = document.toObject();
      if (choice) await this.#applyPowerFromUuid(itemData, choice);
      const created = await context.sheet._moveOrSplitItem(context.event, document, itemData);
      context.handled = true;
      context.result = created ? [created] : false;
   }

   static #effectChanges(effect) {
      const raw = effect.changes ?? effect.system?.changes ?? [];
      return Array.from(raw);
   }

   async #loadPowers() {
      const found = await ComposeFlags.findByRole(COMPOSE_ROLES.ARMOR_POWER);
      return found
         .map((doc) => ({ uuid: doc.uuid, name: doc.name, doc }))
         .sort((a, b) => a.name.localeCompare(b.name));
   }

   async #promptForPower(item) {
      const { DialogV2 } = foundry.applications.api;
      const escapeHtml = MagicItemCompose.escapeHtml;
      const powers = await this.#loadPowers();
      const options = [`<option value="">${escapeHtml(game.i18n.localize("FADEPACK.MagicArmor.powerNone"))}</option>`]
         .concat(powers.map((power) => `<option value="${escapeHtml(power.uuid)}">${escapeHtml(power.name)}</option>`))
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

   async #applyPowerFromUuid(itemData, powerUuid) {
      const doc = await fromUuid(powerUuid);
      if (!doc) {
         console.warn(`FADEPACK: armor power not found: ${powerUuid}`);
         return;
      }
      const compose = ComposeFlags.get(doc);
      const markerAttr = `data-armor-power="${doc.id}"`;
      const label = doc.name;
      MagicItemCompose.applyLinkedTalent(itemData, doc, {
         compose,
         markerAttr,
         nameSuffix: game.i18n.format("FADEPACK.MagicArmor.powerNameSuffix", { power: label }),
         descriptionHtml: game.i18n.format("FADEPACK.MagicArmor.powerDescription", {
            marker: markerAttr,
            power: MagicItemCompose.escapeHtml(label)
         }),
         defaultUnlimitedCharges: true
      });
   }
}
