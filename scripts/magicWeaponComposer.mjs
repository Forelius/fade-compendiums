import { ComposeFlags, COMPOSE_ROLES } from "./composeFlags.mjs";
import { MagicItemCompose } from "./magicItemCompose.mjs";

/** Masteries / name stems treated as missile weapons (separate Ch16 talent table). */
const MISSILE_MASTERIES = new Set([
   "Bow, Long",
   "Bow, Short",
   "Crossbow, Hvy",
   "Crossbow, Heavy",
   "Crossbow, Lt",
   "Crossbow, Light",
   "Sling"
]);

/**
 * Compose magical melee weapons and ammo on actor-sheet drop.
 * Talent membership comes from flags.fade-compendiums.compose.role.
 */
export class MagicWeaponComposer {
   static register() {
      const composer = new MagicWeaponComposer();
      Hooks.on("fadeDropActorSheet", (context) => composer.onDropActorSheet(context));
   }

   static isMagicMeleeWeapon(item) {
      if (!item || item.type !== "weapon") return false;
      if (!MagicWeaponComposer.#isMeleeComposeWeapon(item)) return false;
      if (item.system?.isCursed === true) return true;
      const toHit = Number(item.system?.mod?.toHit) || 0;
      const dmg = Number(item.system?.mod?.dmg) || 0;
      return toHit !== 0 || dmg !== 0;
   }

   static isMagicAmmo(item) {
      if (!item || item.type !== "ammo") return false;
      if (item.system?.isCursed === true) return true;
      const toHit = Number(item.system?.mod?.toHitRanged) || 0;
      const dmg = Number(item.system?.mod?.dmgRanged) || 0;
      return toHit !== 0 || dmg !== 0;
   }

   async onDropActorSheet(context) {
      const document = context?.document;
      if (!document) return;
      const isAmmo = MagicWeaponComposer.isMagicAmmo(document);
      const isMelee = MagicWeaponComposer.isMagicMeleeWeapon(document);
      if (!isAmmo && !isMelee) return;

      const actor = context.sheet?.actor;
      if (document.parent?.uuid && actor?.uuid && document.parent.uuid === actor.uuid) return;
      if (!game.user.isGM) return;

      const choice = isAmmo
         ? await this.#promptForAmmoCompose(document)
         : await this.#promptForCompose(document);
      if (choice == null) {
         context.handled = true;
         context.result = false;
         return;
      }

      const itemData = document.toObject();
      if (isAmmo) await this.#applyAmmoCompose(itemData, choice);
      else await this.#applyCompose(itemData, choice);
      const created = await context.sheet._moveOrSplitItem(context.event, document, itemData);
      context.handled = true;
      context.result = created ? [created] : false;
   }

   static #isMeleeComposeWeapon(item) {
      if (item.system?.natural === true) return false;
      if (item.system?.isAmmo === true) return false;
      const mastery = item.system?.mastery ?? "";
      if (MISSILE_MASTERIES.has(mastery)) return false;
      const name = item.name ?? "";
      if (/^(Bow|Crossbow|Sling)\b/i.test(name)) return false;
      if (/^(Arrow|Quarrel|Pellet|Dart|Bullet)\b/i.test(name)) return false;
      return true;
   }

   static #opponentLabel(groupId) {
      return game.i18n.localize(`FADE.Actor.actorGroups.${groupId}`);
   }

   /**
    * @param {string} role
    * @returns {Promise<Array<{id: string, uuid: string, name: string, doc: Item}>>}
    */
   async #loadTalents(role) {
      const found = await ComposeFlags.findByRole(role);
      return found
         .map((doc) => ({
            id: doc.id,
            uuid: doc.uuid,
            name: doc.name,
            doc
         }))
         .sort((a, b) => a.name.localeCompare(b.name));
   }

   async #promptForCompose(item) {
      const { DialogV2 } = foundry.applications.api;
      const escapeHtml = MagicItemCompose.escapeHtml;
      const talents = await this.#loadTalents(COMPOSE_ROLES.WEAPON_TALENT);
      const opponentOptions = (CONFIG.FADE?.ActorGroups ?? [])
         .filter((group) => !group.special)
         .map((group) => `<option value="${group.id}">${escapeHtml(MagicWeaponComposer.#opponentLabel(group.id))}</option>`)
         .join("");
      const talentOptions = talents
         .map((talent) => `<option value="${escapeHtml(talent.uuid)}">${escapeHtml(talent.name)}</option>`)
         .join("");
      const choice = await DialogV2.wait({
         window: { title: game.i18n.localize("FADEPACK.MagicSword.title") },
         position: { width: 480, height: "auto" },
         rejectClose: false,
         modal: true,
         classes: ["fantastic-depths"],
         content: `<form>
         <p>${game.i18n.format("FADEPACK.MagicSword.intro", { name: escapeHtml(item.name) })}</p>
         <div class="form-group">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.mode"))}</label>
            <select name="mode">
               <option value="none">${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.modeNone"))}</option>
               <option value="opponent">${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.modeOpponent"))}</option>
               <option value="talent">${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.modeTalent"))}</option>
            </select>
         </div>
         <div class="form-group weapon-compose-opponent" style="display: none;">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.opponent"))}</label>
            <select name="groupId">${opponentOptions}</select>
         </div>
         <div class="form-group weapon-compose-opponent" style="display: none;">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.extraBonus"))}</label>
            <select name="extra">
               <option value="1">+1</option>
               <option value="2" selected>+2</option>
               <option value="3">+3</option>
               <option value="4">+4</option>
               <option value="5">+5</option>
            </select>
         </div>
         <div class="form-group weapon-compose-talent" style="display: none;">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.talent"))}</label>
            <select name="talentUuid">${talentOptions}</select>
         </div>
         <div class="form-group">
            <label><input type="checkbox" name="cursed" value="1"/> ${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.cursed"))}</label>
         </div>
      </form>`,
         buttons: [
            {
               action: "add",
               label: game.i18n.localize("FADEPACK.add"),
               default: true,
               callback: (_event, button) => {
                  const form = new foundry.applications.ux.FormDataExtended(button.form).object;
                  return {
                     mode: form.mode || "none",
                     groupId: form.groupId || "",
                     extra: Number(form.extra) || 1,
                     talentUuid: form.talentUuid || "",
                     cursed: form.cursed === true || form.cursed === "1" || form.cursed === "on"
                  };
               }
            },
            {
               action: "cancel",
               label: game.i18n.localize("FADE.dialog.cancel"),
               callback: () => null
            }
         ],
         close: () => null,
         render: (_event, dialog) => {
            const root = dialog.element;
            const modeSelect = root.querySelector('[name="mode"]');
            const syncModeFields = () => {
               const mode = modeSelect?.value || "none";
               root.querySelectorAll(".weapon-compose-opponent").forEach((el) => {
                  el.style.display = mode === "opponent" ? "" : "none";
               });
               root.querySelectorAll(".weapon-compose-talent").forEach((el) => {
                  el.style.display = mode === "talent" ? "" : "none";
               });
            };
            modeSelect?.addEventListener("change", syncModeFields);
            syncModeFields();
         }
      });
      return choice ?? null;
   }

   async #promptForAmmoCompose(item) {
      const { DialogV2 } = foundry.applications.api;
      const escapeHtml = MagicItemCompose.escapeHtml;
      const talents = await this.#loadTalents(COMPOSE_ROLES.MISSILE_TALENT);
      const opponentOptions = (CONFIG.FADE?.ActorGroups ?? [])
         .filter((group) => !group.special)
         .map((group) => `<option value="${group.id}">${escapeHtml(MagicWeaponComposer.#opponentLabel(group.id))}</option>`)
         .join("");
      const talentOptions = talents
         .map((talent) => {
            const prompt = ComposeFlags.get(talent.doc).promptOpponent ? "1" : "0";
            return `<option value="${escapeHtml(talent.uuid)}" data-prompt-opponent="${prompt}">${escapeHtml(talent.name)}</option>`;
         })
         .join("");
      const choice = await DialogV2.wait({
         window: { title: game.i18n.localize("FADEPACK.MagicAmmo.title") },
         position: { width: 480, height: "auto" },
         rejectClose: false,
         modal: true,
         classes: ["fantastic-depths"],
         content: `<form>
         <p>${game.i18n.format("FADEPACK.MagicAmmo.intro", { name: escapeHtml(item.name) })}</p>
         <div class="form-group">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicAmmo.mode"))}</label>
            <select name="mode">
               <option value="none">${escapeHtml(game.i18n.localize("FADEPACK.MagicAmmo.modeNone"))}</option>
               <option value="talent">${escapeHtml(game.i18n.localize("FADEPACK.MagicAmmo.modeTalent"))}</option>
            </select>
         </div>
         <div class="form-group ammo-compose-talent" style="display: none;">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicAmmo.talent"))}</label>
            <select name="talentUuid">${talentOptions}</select>
         </div>
         <div class="form-group ammo-compose-opponent" style="display: none;">
            <label>${escapeHtml(game.i18n.localize("FADEPACK.MagicSword.opponent"))}</label>
            <select name="groupId">${opponentOptions}</select>
         </div>
         <div class="form-group">
            <label><input type="checkbox" name="cursed" value="1"/> ${escapeHtml(game.i18n.localize("FADEPACK.MagicAmmo.cursed"))}</label>
         </div>
      </form>`,
         buttons: [
            {
               action: "add",
               label: game.i18n.localize("FADEPACK.add"),
               default: true,
               callback: (_event, button) => {
                  const form = new foundry.applications.ux.FormDataExtended(button.form).object;
                  return {
                     mode: form.mode || "none",
                     talentUuid: form.talentUuid || "",
                     groupId: form.groupId || "",
                     cursed: form.cursed === true || form.cursed === "1" || form.cursed === "on"
                  };
               }
            },
            {
               action: "cancel",
               label: game.i18n.localize("FADE.dialog.cancel"),
               callback: () => null
            }
         ],
         close: () => null,
         render: (_event, dialog) => {
            const root = dialog.element;
            const modeSelect = root.querySelector('[name="mode"]');
            const talentSelect = root.querySelector('[name="talentUuid"]');
            const syncFields = () => {
               const mode = modeSelect?.value || "none";
               root.querySelectorAll(".ammo-compose-talent").forEach((el) => {
                  el.style.display = mode === "talent" ? "" : "none";
               });
               const selected = talentSelect?.selectedOptions?.[0];
               const promptOpp = mode === "talent" && selected?.dataset?.promptOpponent === "1";
               root.querySelectorAll(".ammo-compose-opponent").forEach((el) => {
                  el.style.display = promptOpp ? "" : "none";
               });
            };
            modeSelect?.addEventListener("change", syncFields);
            talentSelect?.addEventListener("change", syncFields);
            syncFields();
         }
      });
      return choice ?? null;
   }

   async #applyCompose(itemData, choice) {
      itemData.system.spells ??= [];
      itemData.system.specialAbilities ??= [];
      itemData.system.mod ??= {};
      itemData.system.mod.vsGroup ??= {};

      if (choice.mode === "opponent" && choice.groupId) {
         const extra = Math.min(5, Math.max(1, Number(choice.extra) || 1));
         const label = MagicWeaponComposer.#opponentLabel(choice.groupId);
         itemData.system.mod.vsGroup[choice.groupId] = { toHit: extra, dmg: extra, special: null };
         const suffix = game.i18n.format("FADEPACK.MagicSword.vsNameSuffix", { extra, group: label });
         if (!itemData.name.includes(` vs ${label}`)) itemData.name = `${itemData.name}${suffix}`;
         const marker = `data-weapon-vs="${choice.groupId}"`;
         if (!String(itemData.system.description ?? "").includes(marker)) {
            const total = (Number(itemData.system.mod.toHit) || 0) + extra;
            itemData.system.description = `${itemData.system.description ?? ""}${game.i18n.format("FADEPACK.MagicSword.vsDescription", {
               marker,
               extra,
               total,
               group: MagicItemCompose.escapeHtml(label)
            })}`;
         }
      } else if (choice.mode === "talent" && choice.talentUuid) {
         await this.#applyTalentFromUuid(itemData, choice.talentUuid, {
            markerPrefix: "data-weapon-talent",
            nameKey: "FADEPACK.MagicSword.talentNameSuffix",
            descKey: "FADEPACK.MagicSword.talentDescription",
            defaultUnlimitedCharges: true
         });
      }

      if (choice.cursed) {
         MagicItemCompose.applyCurseNegate(itemData, ["system.mod.toHit", "system.mod.dmg"]);
         if (!/\bCursed\b/i.test(itemData.name)) {
            itemData.name = game.i18n.format("FADEPACK.MagicSword.cursedNamePrefix", { name: itemData.name });
         }
         const marker = 'data-weapon-cursed="1"';
         if (!String(itemData.system.description ?? "").includes(marker)) {
            itemData.system.description = `${itemData.system.description ?? ""}${game.i18n.format("FADEPACK.MagicSword.cursedDescription", { marker })}`;
         }
      }
   }

   async #applyAmmoCompose(itemData, choice) {
      itemData.system.spells ??= [];
      itemData.system.specialAbilities ??= [];
      itemData.system.mod ??= {};
      itemData.system.mod.vsGroup ??= {};

      if (choice.mode === "talent" && choice.talentUuid) {
         const applied = await this.#applyTalentFromUuid(itemData, choice.talentUuid, {
            markerPrefix: "data-missile-talent",
            nameKey: "FADEPACK.MagicAmmo.talentNameSuffix",
            descKey: "FADEPACK.MagicAmmo.talentDescription",
            // Infinite charges: quantity is the only ammo spend pool (spent when fired).
            defaultUnlimitedCharges: true
         });
         if (applied?.compose?.promptOpponent && choice.groupId) {
            const label = MagicWeaponComposer.#opponentLabel(choice.groupId);
            const suffix = game.i18n.format("FADEPACK.MagicAmmo.vsNameSuffix", { group: label });
            if (!itemData.name.includes(suffix)) itemData.name = `${itemData.name}${suffix}`;
            const marker = `data-missile-slaying="${choice.groupId}"`;
            if (!String(itemData.system.description ?? "").includes(marker)) {
               itemData.system.description = `${itemData.system.description ?? ""}${game.i18n.format("FADEPACK.MagicAmmo.vsDescription", {
                  marker,
                  group: MagicItemCompose.escapeHtml(label)
               })}`;
            }
         }
      }

      // Magic ammo: never a finite charge pool — quantity tracks arrows/bolts remaining.
      itemData.system.charges = 1;
      itemData.system.chargesMax = null;

      if (choice.cursed) {
         MagicItemCompose.applyCurseNegate(itemData, ["system.mod.toHitRanged", "system.mod.dmgRanged"]);
         if (!/\bCursed\b/i.test(itemData.name)) {
            itemData.name = game.i18n.format("FADEPACK.MagicAmmo.cursedNamePrefix", { name: itemData.name });
         }
         const marker = 'data-ammo-cursed="1"';
         if (!String(itemData.system.description ?? "").includes(marker)) {
            itemData.system.description = `${itemData.system.description ?? ""}${game.i18n.format("FADEPACK.MagicAmmo.cursedDescription", { marker })}`;
         }
      }
   }

   /**
    * @returns {Promise<{compose: object}|null>}
    */
   async #applyTalentFromUuid(itemData, talentUuid, opts) {
      const doc = await fromUuid(talentUuid);
      if (!doc) {
         console.warn(`FADEPACK: talent not found: ${talentUuid}`);
         return null;
      }
      const compose = ComposeFlags.get(doc);
      const entryId = doc.id ?? "talent";
      const markerAttr = `${opts.markerPrefix}="${entryId}"`;
      const label = doc.name;
      MagicItemCompose.applyLinkedTalent(itemData, doc, {
         compose,
         markerAttr,
         nameSuffix: game.i18n.format(opts.nameKey, { talent: label }),
         descriptionHtml: game.i18n.format(opts.descKey, {
            marker: markerAttr,
            talent: MagicItemCompose.escapeHtml(label)
         }),
         defaultUnlimitedCharges: opts.defaultUnlimitedCharges,
         entryId
      });
      return { compose };
   }
}
