const PACK = "Compendium.fade-compendiums.item-compendium.Item";

/**
 * Manual smoke checks (GM, actor sheet):
 * 1. Drop Sword, Normal +3 — add as is; confirm +3 toHit/dmg.
 * 2. Drop Sword, Short +2 — vs opponent undead, extra +2; confirm name and vsGroup undead toHit/dmg = 2.
 * 3. Drop Sword, Bastard (1H) +1 — talent Flaming; confirm Flaming SA linked and flaming-weak / undead vsGroup set.
 * 4. Drop Sword, Two-Handed +2 — cursed; confirm isCursed and negated mods.
 */

/** Sword masteries used by stock magical swords. */
const SWORD_MASTERIES = new Set([
   "Sword, Short",
   "Sword, Normal",
   "Sword, Bastard (1H)",
   "Sword, Bastard (2H)",
   "Sword, Two-Handed"
]);

/**
 * Weapon talents. Spell talents link through system.spells; special abilities through system.specialAbilities.
 * Labels/summaries live in FADEPACK.SwordTalent.<id>.
 * @type {Array<{id: string, kind: "spell"|"specialAbility", uuid: string, docName: string, action: string, vsGroups?: Array<{id: string, toHit: number, dmg: number, doubleBonus?: boolean}>}>}
 */
const SWORD_TALENTS = [
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

/** @param {string} key @param {Record<string, unknown>} [data] */
function L(key, data) {
   return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

/** @param {string} groupId */
function opponentLabel(groupId) {
   return game.i18n.localize(`FADE.Actor.actorGroups.${groupId}`);
}

/**
 * Magical swords use nonzero toHit/dmg mods, or are cursed.
 * @param {Item|null} item
 * @returns {boolean}
 */
export function isMagicSword(item) {
   if (!item || item.type !== "weapon") return false;
   if (!isSwordWeapon(item)) return false;
   if (item.system?.isCursed === true) return true;
   const toHit = Number(item.system?.mod?.toHit) || 0;
   const dmg = Number(item.system?.mod?.dmg) || 0;
   return toHit !== 0 || dmg !== 0;
}

/**
 * @param {Item} item
 * @returns {boolean}
 */
function isSwordWeapon(item) {
   const mastery = item.system?.mastery ?? "";
   if (SWORD_MASTERIES.has(mastery)) return true;
   const name = item.name ?? "";
   return /^Sword,\s/i.test(name) || /^Sword\s/i.test(name);
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
 * @returns {Promise<{mode: string, groupId?: string, extra?: number, talentId?: string, cursed?: boolean}|null>}
 */
async function promptForCompose(item) {
   const { DialogV2 } = foundry.applications.api;
   const opponentOptions = (CONFIG.FADE?.ActorGroups ?? [])
      .filter((group) => !group.special)
      .map((group) => `<option value="${group.id}">${escapeHtml(opponentLabel(group.id))}</option>`)
      .join("");
   const talentOptions = SWORD_TALENTS
      .map((talent) => `<option value="${talent.id}">${escapeHtml(talent.docName)}</option>`)
      .join("");
   const choice = await DialogV2.wait({
      window: { title: L("FADEPACK.MagicSword.title") },
      position: { width: 480, height: "auto" },
      rejectClose: false,
      modal: true,
      classes: ["fantastic-depths"],
      content: `<form>
         <p>${L("FADEPACK.MagicSword.intro", { name: escapeHtml(item.name) })}</p>
         <div class="form-group">
            <label>${escapeHtml(L("FADEPACK.MagicSword.mode"))}</label>
            <select name="mode">
               <option value="none">${escapeHtml(L("FADEPACK.MagicSword.modeNone"))}</option>
               <option value="opponent">${escapeHtml(L("FADEPACK.MagicSword.modeOpponent"))}</option>
               <option value="talent">${escapeHtml(L("FADEPACK.MagicSword.modeTalent"))}</option>
            </select>
         </div>
         <div class="form-group sword-compose-opponent" style="display: none;">
            <label>${escapeHtml(L("FADEPACK.MagicSword.opponent"))}</label>
            <select name="groupId">${opponentOptions}</select>
         </div>
         <div class="form-group sword-compose-opponent" style="display: none;">
            <label>${escapeHtml(L("FADEPACK.MagicSword.extraBonus"))}</label>
            <select name="extra">
               <option value="1">+1</option>
               <option value="2" selected>+2</option>
               <option value="3">+3</option>
               <option value="4">+4</option>
               <option value="5">+5</option>
            </select>
         </div>
         <div class="form-group sword-compose-talent" style="display: none;">
            <label>${escapeHtml(L("FADEPACK.MagicSword.talent"))}</label>
            <select name="talentId">${talentOptions}</select>
         </div>
         <div class="form-group">
            <label><input type="checkbox" name="cursed" value="1"/> ${escapeHtml(L("FADEPACK.MagicSword.cursed"))}</label>
         </div>
      </form>`,
      buttons: [
         {
            action: "add",
            label: L("FADEPACK.add"),
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
            root.querySelectorAll(".sword-compose-opponent").forEach((el) => {
               el.style.display = mode === "opponent" ? "" : "none";
            });
            root.querySelectorAll(".sword-compose-talent").forEach((el) => {
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
function applyCompose(itemData, choice) {
   itemData.system.spells ??= [];
   itemData.system.specialAbilities ??= [];
   itemData.system.mod ??= {};
   itemData.system.mod.vsGroup ??= {};

   if (choice.mode === "opponent" && choice.groupId) {
      const extra = Math.min(5, Math.max(1, Number(choice.extra) || 1));
      const label = opponentLabel(choice.groupId);
      // Store EXTRA only; base toHit/dmg already apply, so totals match RC naming.
      itemData.system.mod.vsGroup[choice.groupId] = {
         toHit: extra,
         dmg: extra,
         special: null
      };
      const suffix = L("FADEPACK.MagicSword.vsNameSuffix", { extra, group: label });
      if (!itemData.name.includes(` vs ${label}`)) itemData.name = `${itemData.name}${suffix}`;
      const marker = `data-sword-vs="${choice.groupId}"`;
      if (!String(itemData.system.description ?? "").includes(marker)) {
         const total = (Number(itemData.system.mod.toHit) || 0) + extra;
         itemData.system.description = `${itemData.system.description ?? ""}${L("FADEPACK.MagicSword.vsDescription", {
            marker,
            extra,
            total,
            group: escapeHtml(label)
         })}`;
      }
   } else if (choice.mode === "talent" && choice.talentId) {
      const talent = SWORD_TALENTS.find((entry) => entry.id === choice.talentId);
      if (talent) applyTalent(itemData, talent);
   }

   if (choice.cursed) applyCurse(itemData);
}

/**
 * @param {object} itemData
 * @param {typeof SWORD_TALENTS[number]} talent
 */
function applyTalent(itemData, talent) {
   const linked = [...itemData.system.spells, ...itemData.system.specialAbilities];
   const label = talent.docName;
   const suffix = L("FADEPACK.MagicSword.talentNameSuffix", { talent: label });
   if (!itemData.name.endsWith(suffix) && !itemData.name.includes(suffix)) {
      itemData.name = `${itemData.name}${suffix}`;
   }
   const marker = `data-sword-talent="${talent.id}"`;
   if (!String(itemData.system.description ?? "").includes(marker)) {
      itemData.system.description = `${itemData.system.description ?? ""}${L("FADEPACK.MagicSword.talentDescription", {
         marker,
         talent: escapeHtml(label)
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
function applyCurse(itemData) {
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
      itemData.name = L("FADEPACK.MagicSword.cursedNamePrefix", { name: itemData.name });
   }
   const marker = 'data-sword-cursed="1"';
   if (!String(itemData.system.description ?? "").includes(marker)) {
      itemData.system.description = `${itemData.system.description ?? ""}${L("FADEPACK.MagicSword.cursedDescription", { marker })}`;
   }
}

/** Listen for magic sword drops and offer to compose one additional modifier. */
export function registerMagicSwordDrop() {
   Hooks.on("fadeDropActorSheet", async (context) => {
      const document = context?.document;
      if (!document || !isMagicSword(document)) return;
      const actor = context.sheet?.actor;
      if (document.parent?.uuid && actor?.uuid && document.parent.uuid === actor.uuid) return;
      if (!game.user.isGM) return;

      const choice = await promptForCompose(document);
      if (choice == null) {
         context.handled = true;
         context.result = false;
         return;
      }

      const itemData = document.toObject();
      applyCompose(itemData, choice);
      const created = await context.sheet._moveOrSplitItem(context.event, document, itemData);
      context.handled = true;
      context.result = created ? [created] : false;
   });
}
