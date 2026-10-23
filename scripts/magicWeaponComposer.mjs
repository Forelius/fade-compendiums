const PACK = "Compendium.fade-compendiums.item-compendium.Item";

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
 * Compose magical melee weapons on actor-sheet drop (as-is / vs-opponent / talent / cursed).
 *
 * Manual smoke checks (GM, actor sheet):
 * 1. Drop Sword, Normal +3 — add as is; confirm +3 toHit/dmg.
 * 2. Drop Axe, Battle +2 — talent Flaming; confirm Flaming SA linked.
 * 3. Drop Spear +1 — vs opponent undead, extra +2; confirm vsGroup.
 * 4. Drop Mace +1 — cursed; confirm isCursed and negated mods.
 */
export class MagicWeaponComposer {
   /**
    * Melee weapon talents (Ch16). Spell talents link through system.spells; special abilities through system.specialAbilities.
    * @type {Array<{id: string, kind: "spell"|"specialAbility", uuid: string, docName: string, action: string, vsGroups?: Array<{id: string, toHit: number, dmg: number, doubleBonus?: boolean}>}>}
    */
   static WEAPON_TALENTS = [
      { id: "breathing", kind: "spell", uuid: `${PACK}.SwTBreathing0001`, docName: "Breathing (Weapon)", action: "use" },
      { id: "charming", kind: "spell", uuid: `${PACK}.SwTCharming00002`, docName: "Charming (Weapon)", action: "use" },
      { id: "deceiving", kind: "specialAbility", uuid: `${PACK}.SwTDeceiving0003`, docName: "Deceiving", action: "use" },
      { id: "defending", kind: "specialAbility", uuid: `${PACK}.SwTDefending0004`, docName: "Defending", action: "use" },
      { id: "deflecting", kind: "specialAbility", uuid: `${PACK}.SwTDeflecting005`, docName: "Deflecting", action: "use" },
      { id: "draining", kind: "specialAbility", uuid: `${PACK}.SwTDraining00006`, docName: "Draining", action: "use" },
      {
         id: "extinguishing",
         kind: "specialAbility",
         uuid: `${PACK}.SwTExtinguish007`,
         docName: "Extinguishing",
         action: "use",
         vsGroups: [{ id: "flaming-weak", toHit: 0, dmg: 0, doubleBonus: true }]
      },
      { id: "finding", kind: "spell", uuid: `${PACK}.SwTFinding000008`, docName: "Finding (Weapon)", action: "use" },
      {
         id: "flaming",
         kind: "specialAbility",
         uuid: `${PACK}.SwTFlaming000009`,
         docName: "Flaming",
         action: "use",
         vsGroups: [
            { id: "flaming-weak", toHit: 2, dmg: 2 },
            { id: "undead", toHit: 3, dmg: 3 }
         ]
      },
      { id: "flying", kind: "specialAbility", uuid: `${PACK}.SwTFlying0000010`, docName: "Flying (Weapon)", action: "use" },
      { id: "healing", kind: "spell", uuid: `${PACK}.SwTHealing000011`, docName: "Healing (Weapon)", action: "use" },
      { id: "hiding", kind: "spell", uuid: `${PACK}.SwTHiding0000012`, docName: "Hiding (Weapon)", action: "use" },
      { id: "holding", kind: "spell", uuid: `${PACK}.SwTHolding000013`, docName: "Holding (Weapon)", action: "use" },
      { id: "lighting", kind: "spell", uuid: `${PACK}.SwTLighting00014`, docName: "Lighting (Weapon)", action: "use" },
      { id: "silencing", kind: "spell", uuid: `${PACK}.SwTSilencing0015`, docName: "Silencing (Weapon)", action: "use" },
      { id: "slicing", kind: "specialAbility", uuid: `${PACK}.SwTSlicing000016`, docName: "Slicing", action: "use" },
      { id: "slowing", kind: "specialAbility", uuid: `${PACK}.SwTSlowing000017`, docName: "Slowing", action: "use" },
      { id: "speeding", kind: "spell", uuid: `${PACK}.SwTSpeeding00018`, docName: "Speeding (Weapon)", action: "use" },
      { id: "translating", kind: "specialAbility", uuid: `${PACK}.SwTTranslating19`, docName: "Translating", action: "use" },
      { id: "watching", kind: "specialAbility", uuid: `${PACK}.SwTWatching00020`, docName: "Watching", action: "use" },
      { id: "wishing", kind: "specialAbility", uuid: `${PACK}.SwTWishing000021`, docName: "Wishing", action: "use" }
   ];

   /** Listen for magic melee weapon drops and offer to compose one additional modifier. */
   static register() {
      const composer = new MagicWeaponComposer();
      Hooks.on("fadeDropActorSheet", (context) => composer.onDropActorSheet(context));
   }

   /**
    * Magical melee weapons use nonzero toHit/dmg mods, or are cursed.
    * @param {Item|null} item
    * @returns {boolean}
    */
   static isMagicMeleeWeapon(item) {
      if (!item || item.type !== "weapon") return false;
      if (!MagicWeaponComposer.#isMeleeComposeWeapon(item)) return false;
      if (item.system?.isCursed === true) return true;
      const toHit = Number(item.system?.mod?.toHit) || 0;
      const dmg = Number(item.system?.mod?.dmg) || 0;
      return toHit !== 0 || dmg !== 0;
   }

   /**
    * @param {object} context fadeDropActorSheet hook context
    */
   async onDropActorSheet(context) {
      const document = context?.document;
      if (!document || !MagicWeaponComposer.isMagicMeleeWeapon(document)) return;
      const actor = context.sheet?.actor;
      if (document.parent?.uuid && actor?.uuid && document.parent.uuid === actor.uuid) return;
      if (!game.user.isGM) return;

      const choice = await this.#promptForCompose(document);
      if (choice == null) {
         context.handled = true;
         context.result = false;
         return;
      }

      const itemData = document.toObject();
      this.#applyCompose(itemData, choice);
      const created = await context.sheet._moveOrSplitItem(context.event, document, itemData);
      context.handled = true;
      context.result = created ? [created] : false;
   }

   /**
    * Handheld melee (or thrown melee) gear — not ammo, natural attacks, or dedicated missile weapons.
    * @param {Item} item
    * @returns {boolean}
    */
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

   /**
    * @param {string} groupId
    * @returns {string}
    */
   static #opponentLabel(groupId) {
      return game.i18n.localize(`FADE.Actor.actorGroups.${groupId}`);
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
    * @returns {Promise<{mode: string, groupId?: string, extra?: number, talentId?: string, cursed?: boolean}|null>}
    */
   async #promptForCompose(item) {
      const { DialogV2 } = foundry.applications.api;
      const escapeHtml = MagicWeaponComposer.#escapeHtml;
      const opponentOptions = (CONFIG.FADE?.ActorGroups ?? [])
         .filter((group) => !group.special)
         .map((group) => `<option value="${group.id}">${escapeHtml(MagicWeaponComposer.#opponentLabel(group.id))}</option>`)
         .join("");
      const talentOptions = MagicWeaponComposer.WEAPON_TALENTS
         .map((talent) => `<option value="${talent.id}">${escapeHtml(talent.docName)}</option>`)
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
            <select name="talentId">${talentOptions}</select>
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
                     talentId: form.talentId || "",
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

   /**
    * @param {object} itemData
    * @param {{mode: string, groupId?: string, extra?: number, talentId?: string, cursed?: boolean}} choice
    */
   #applyCompose(itemData, choice) {
      itemData.system.spells ??= [];
      itemData.system.specialAbilities ??= [];
      itemData.system.mod ??= {};
      itemData.system.mod.vsGroup ??= {};

      if (choice.mode === "opponent" && choice.groupId) {
         const extra = Math.min(5, Math.max(1, Number(choice.extra) || 1));
         const label = MagicWeaponComposer.#opponentLabel(choice.groupId);
         // Store EXTRA only; base toHit/dmg already apply, so totals match RC naming.
         itemData.system.mod.vsGroup[choice.groupId] = {
            toHit: extra,
            dmg: extra,
            special: null
         };
         const suffix = game.i18n.format("FADEPACK.MagicSword.vsNameSuffix", { extra, group: label });
         if (!itemData.name.includes(` vs ${label}`)) itemData.name = `${itemData.name}${suffix}`;
         const marker = `data-weapon-vs="${choice.groupId}"`;
         if (!String(itemData.system.description ?? "").includes(marker)) {
            const total = (Number(itemData.system.mod.toHit) || 0) + extra;
            itemData.system.description = `${itemData.system.description ?? ""}${game.i18n.format("FADEPACK.MagicSword.vsDescription", {
               marker,
               extra,
               total,
               group: MagicWeaponComposer.#escapeHtml(label)
            })}`;
         }
      } else if (choice.mode === "talent" && choice.talentId) {
         const talent = MagicWeaponComposer.WEAPON_TALENTS.find((entry) => entry.id === choice.talentId);
         if (talent) this.#applyTalent(itemData, talent);
      }

      if (choice.cursed) this.#applyCurse(itemData);
   }

   /**
    * @param {object} itemData
    * @param {typeof MagicWeaponComposer.WEAPON_TALENTS[number]} talent
    */
   #applyTalent(itemData, talent) {
      const linked = [...itemData.system.spells, ...itemData.system.specialAbilities];
      const label = talent.docName;
      const suffix = game.i18n.format("FADEPACK.MagicSword.talentNameSuffix", { talent: label });
      if (!itemData.name.endsWith(suffix) && !itemData.name.includes(suffix)) {
         itemData.name = `${itemData.name}${suffix}`;
      }
      const marker = `data-weapon-talent="${talent.id}"`;
      if (!String(itemData.system.description ?? "").includes(marker)) {
         itemData.system.description = `${itemData.system.description ?? ""}${game.i18n.format("FADEPACK.MagicSword.talentDescription", {
            marker,
            talent: MagicWeaponComposer.#escapeHtml(label)
         })}`;
      }
      if (!linked.some((entry) => entry.uuid === talent.uuid)) {
         if (talent.kind === "spell") {
            itemData.system.spells.push({
               uuid: talent.uuid,
               action: talent.action,
               castAs: "",
               name: talent.docName
            });
         } else {
            itemData.system.specialAbilities.push({
               uuid: talent.uuid,
               action: talent.action,
               name: talent.docName,
               mod: 0
            });
         }
      }
      if (talent.vsGroups?.length) {
         for (const group of talent.vsGroups) {
            if (group.doubleBonus) {
               const base = Math.abs(Number(itemData.system.mod.toHit) || 0);
               // Extra so total vs that group is double the base bonus.
               itemData.system.mod.vsGroup[group.id] = {
                  toHit: base,
                  dmg: base,
                  special: null
               };
            } else {
               itemData.system.mod.vsGroup[group.id] = {
                  toHit: group.toHit,
                  dmg: group.dmg,
                  special: null
               };
            }
         }
      }
      if (!(itemData.system.chargesMax > 0) && itemData.system.chargesMax !== null) {
         itemData.system.charges = 1;
         itemData.system.chargesMax = null;
      }
   }

   /**
    * @param {object} itemData
    */
   #applyCurse(itemData) {
      itemData.system.isCursed = true;
      const toHit = Number(itemData.system.mod.toHit) || 0;
      const dmg = Number(itemData.system.mod.dmg) || 0;
      if (toHit > 0) itemData.system.mod.toHit = -toHit;
      if (dmg > 0) itemData.system.mod.dmg = -dmg;
      for (const [groupId, modData] of Object.entries(itemData.system.mod.vsGroup || {})) {
         const hit = Number(modData.toHit) || 0;
         const damage = Number(modData.dmg) || 0;
         if (hit > 0) modData.toHit = -hit;
         if (damage > 0) modData.dmg = -damage;
         itemData.system.mod.vsGroup[groupId] = modData;
      }
      if (!/\bCursed\b/i.test(itemData.name)) {
         itemData.name = game.i18n.format("FADEPACK.MagicSword.cursedNamePrefix", { name: itemData.name });
      }
      const marker = 'data-weapon-cursed="1"';
      if (!String(itemData.system.description ?? "").includes(marker)) {
         itemData.system.description = `${itemData.system.description ?? ""}${game.i18n.format("FADEPACK.MagicSword.cursedDescription", { marker })}`;
      }
   }
}
