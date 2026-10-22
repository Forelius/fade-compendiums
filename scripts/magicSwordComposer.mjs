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
 * Opponent groups from CONFIG.FADE.ActorGroups that map to RC weapon opponents.
 * Labels are for the compose dialog only.
 */
const OPPONENT_GROUPS = [
   { id: "bugs", label: "Bugs" },
   { id: "constructs", label: "Constructs" },
   { id: "dragonkind", label: "Dragonkind" },
   { id: "enchanted", label: "Enchanted monsters" },
   { id: "giantkind", label: "Giantkind" },
   { id: "lycanthropes", label: "Lycanthropes" },
   { id: "planar", label: "Planar monsters" },
   { id: "regenerating", label: "Regenerating monsters" },
   { id: "reptiles-dinosaurs", label: "Reptiles and dinosaurs" },
   { id: "spell-immune", label: "Spell-immune monsters" },
   { id: "spellcasters", label: "Spellcasters" },
   { id: "undead", label: "Undead" },
   { id: "water-breathing", label: "Water-breathing monsters" },
   { id: "weapon-using", label: "Weapon-using monsters" }
];

/**
 * Weapon talents. Spell talents link through system.spells; special abilities through system.specialAbilities.
 * @type {Array<{id: string, label: string, kind: "spell"|"specialAbility", uuid: string, docName: string, action: string, summary: string, vsGroups?: Array<{id: string, toHit: number, dmg: number}>}>}
 */
const SWORD_TALENTS = [
   {
      id: "breathing",
      label: "Breathing",
      kind: "spell",
      uuid: `${PACK}.SwTBreathing0001`,
      docName: "Breathing (Weapon)",
      action: "use",
      summary: "Once per day: water breathing or air breathing (1 turn). Air breathing does not stop breath weapons. Daily limit is manual."
   },
   {
      id: "charming",
      label: "Charming",
      kind: "spell",
      uuid: `${PACK}.SwTCharming00002`,
      docName: "Charming (Weapon)",
      action: "use",
      summary: "Once per day: charm person to 120'. Apply Charmed from the chat card. Save and daily limit are manual."
   },
   {
      id: "deceiving",
      label: "Deceiving",
      kind: "specialAbility",
      uuid: `${PACK}.SwTDeceiving0003`,
      docName: "Deceiving",
      action: "use",
      summary: "Disguise the user's appearance while the weapon is held. Illusion only; size cannot change. Manual."
   },
   {
      id: "defending",
      label: "Defending",
      kind: "specialAbility",
      uuid: `${PACK}.SwTDefending0004`,
      docName: "Defending",
      action: "use",
      summary: "Each round, use the weapon's bonus either for attack and damage or for Armor Class. Choose manually."
   },
   {
      id: "deflecting",
      label: "Deflecting",
      kind: "specialAbility",
      uuid: `${PACK}.SwTDeflecting005`,
      docName: "Deflecting",
      action: "use",
      summary: "Deflect an energy-drain hit at the cost of one magical bonus per level drained. Track bonus loss manually."
   },
   {
      id: "draining",
      label: "Draining",
      kind: "specialAbility",
      uuid: `${PACK}.SwTDraining00006`,
      docName: "Draining",
      action: "use",
      summary: "On command after a hit, drain one level (1d4+4 total uses, then gone). Manual."
   },
   {
      id: "extinguishing",
      label: "Extinguishing",
      kind: "specialAbility",
      uuid: `${PACK}.SwTExtinguish007`,
      docName: "Extinguishing",
      action: "use",
      summary: "Cool to the touch; double bonus vs fire-using creatures; douse normal fire. Thrust into fire is manual.",
      vsGroups: [{ id: "flaming-weak", toHit: 0, dmg: 0, doubleBonus: true }]
   },
   {
      id: "finding",
      label: "Finding",
      kind: "spell",
      uuid: `${PACK}.SwTFinding000008`,
      docName: "Finding (Weapon)",
      action: "use",
      summary: "Once per day: locate object to 120'. Daily limit is manual."
   },
   {
      id: "flaming",
      label: "Flaming",
      kind: "specialAbility",
      uuid: `${PACK}.SwTFlaming000009`,
      docName: "Flaming",
      action: "use",
      summary: "On command, blade flames: +2 vs flaming-weak foes, +3 vs undead. Lighting fires is manual.",
      vsGroups: [
         { id: "flaming-weak", toHit: 2, dmg: 2 },
         { id: "undead", toHit: 3, dmg: 3 }
      ]
   },
   {
      id: "flying",
      label: "Flying",
      kind: "specialAbility",
      uuid: `${PACK}.SwTFlying0000010`,
      docName: "Flying (Weapon)",
      action: "use",
      summary: "After one normal attack, the weapon can fly and attack alone for 3 rounds. Resolve manually."
   },
   {
      id: "healing",
      label: "Healing",
      kind: "spell",
      uuid: `${PACK}.SwTHealing000011`,
      docName: "Healing (Weapon)",
      action: "use",
      summary: "Once per day: cure serious wounds on the user only (2d6+2). Daily limit is manual."
   },
   {
      id: "hiding",
      label: "Hiding",
      kind: "spell",
      uuid: `${PACK}.SwTHiding0000012`,
      docName: "Hiding (Weapon)",
      action: "use",
      summary: "Invisibility on the user; weapon can turn invisible 3/day separately. Apply Invisible from the chat card."
   },
   {
      id: "holding",
      label: "Holding",
      kind: "spell",
      uuid: `${PACK}.SwTHolding000013`,
      docName: "Holding (Weapon)",
      action: "use",
      summary: "Once per day: hold person to 180'. Save and daily limit are manual."
   },
   {
      id: "lighting",
      label: "Lighting",
      kind: "spell",
      uuid: `${PACK}.SwTLighting00014`,
      docName: "Lighting (Weapon)",
      action: "use",
      summary: "Once per day: light to 120' for 6 turns. Daily limit is manual."
   },
   {
      id: "silencing",
      label: "Silencing",
      kind: "spell",
      uuid: `${PACK}.SwTSilencing0015`,
      docName: "Silencing (Weapon)",
      action: "use",
      summary: "Once per day: silence 15' radius to 180'. Daily limit is manual."
   },
   {
      id: "slicing",
      label: "Slicing",
      kind: "specialAbility",
      uuid: `${PACK}.SwTSlicing000016`,
      docName: "Slicing",
      action: "use",
      summary: "On a 19–20 with magical bonus only, save vs death ray or die; save still takes triple damage. Manual."
   },
   {
      id: "slowing",
      label: "Slowing",
      kind: "specialAbility",
      uuid: `${PACK}.SwTSlowing000017`,
      docName: "Slowing",
      action: "use",
      summary: "On a hit, may slow the foe for 1 turn (no save). Apply Slowed from the chat card. On-hit choice is manual."
   },
   {
      id: "speeding",
      label: "Speeding",
      kind: "spell",
      uuid: `${PACK}.SwTSpeeding00018`,
      docName: "Speeding (Weapon)",
      action: "use",
      summary: "Once per day: haste on the user for 1 turn. Apply Hasted from the chat card."
   },
   {
      id: "translating",
      label: "Translating",
      kind: "specialAbility",
      uuid: `${PACK}.SwTTranslating19`,
      docName: "Translating",
      action: "use",
      summary: "Understand all languages heard for 6 turns. Duration is manual."
   },
   {
      id: "watching",
      label: "Watching",
      kind: "specialAbility",
      uuid: `${PACK}.SwTWatching00020`,
      docName: "Watching",
      action: "use",
      summary: "Sense one monster type or race within 60' (vibrates). One type per day. Manual."
   },
   {
      id: "wishing",
      label: "Wishing",
      kind: "specialAbility",
      uuid: `${PACK}.SwTWishing000021`,
      docName: "Wishing",
      action: "use",
      summary: "Grants 1d3 wishes. Track remaining wishes manually."
   }
];

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
   const opponentOptions = OPPONENT_GROUPS
      .map((group) => `<option value="${group.id}">${escapeHtml(group.label)}</option>`)
      .join("");
   const talentOptions = SWORD_TALENTS
      .map((talent) => `<option value="${talent.id}">${escapeHtml(talent.label)}</option>`)
      .join("");
   const choice = await DialogV2.wait({
      window: { title: "Magic Sword" },
      position: { width: 480, height: "auto" },
      rejectClose: false,
      modal: true,
      classes: ["fantastic-depths"],
      content: `<form>
         <p>Add <strong>${escapeHtml(item.name)}</strong> as it is, or attach one additional modifier (opponent bonus or talent — not both). Optionally mark it cursed.</p>
         <div class="form-group">
            <label>Mode</label>
            <select name="mode">
               <option value="none">None — add as is</option>
               <option value="opponent">Bonus vs opponent</option>
               <option value="talent">Talent</option>
            </select>
         </div>
         <div class="form-group sword-compose-opponent" style="display: none;">
            <label>Opponent</label>
            <select name="groupId">${opponentOptions}</select>
         </div>
         <div class="form-group sword-compose-opponent" style="display: none;">
            <label>Extra bonus</label>
            <select name="extra">
               <option value="1">+1</option>
               <option value="2" selected>+2</option>
               <option value="3">+3</option>
               <option value="4">+4</option>
               <option value="5">+5</option>
            </select>
         </div>
         <div class="form-group sword-compose-talent" style="display: none;">
            <label>Talent</label>
            <select name="talentId">${talentOptions}</select>
         </div>
         <div class="form-group">
            <label><input type="checkbox" name="cursed" value="1"/> Cursed (negate magical bonuses)</label>
         </div>
      </form>`,
      buttons: [
         {
            action: "add",
            label: "Add",
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
            label: "Cancel",
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
      const group = OPPONENT_GROUPS.find((entry) => entry.id === choice.groupId);
      const label = group?.label ?? choice.groupId;
      // Store EXTRA only; base toHit/dmg already apply, so totals match RC naming.
      itemData.system.mod.vsGroup[choice.groupId] = {
         toHit: extra,
         dmg: extra,
         special: null
      };
      const suffix = `, +${extra} vs ${label}`;
      if (!itemData.name.includes(` vs ${label}`)) itemData.name = `${itemData.name}${suffix}`;
      const marker = `data-sword-vs="${choice.groupId}"`;
      if (!String(itemData.system.description ?? "").includes(marker)) {
         const totalHint = (Number(itemData.system.mod.toHit) || 0) + extra;
         itemData.system.description = `${itemData.system.description ?? ""}<p ${marker}><strong>Additional modifier:</strong> +${extra} extra (+${totalHint} total) vs ${escapeHtml(label)}.</p>`;
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
   const suffix = ` of ${talent.label}`;
   if (!itemData.name.endsWith(suffix) && !itemData.name.includes(` of ${talent.label}`)) {
      itemData.name = `${itemData.name}${suffix}`;
   }
   const marker = `data-sword-talent="${talent.id}"`;
   if (!String(itemData.system.description ?? "").includes(marker)) {
      itemData.system.description = `${itemData.system.description ?? ""}<p ${marker}><strong>Talent: ${escapeHtml(talent.label)}.</strong> ${escapeHtml(talent.summary)}</p>`;
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
   if (!/\bCursed\b/i.test(itemData.name)) itemData.name = `Cursed ${itemData.name}`;
   const marker = 'data-sword-cursed="1"';
   if (!String(itemData.system.description ?? "").includes(marker)) {
      itemData.system.description = `${itemData.system.description ?? ""}<p ${marker}><strong>Cursed.</strong> Magical bonuses are penalties. The wielder cannot willingly discard it once used in battle (unequip blocked for non-GM). Compulsion to always use it in battle is manual. Remove curse / dispel evil may lift the compulsion or restore the sword per RC.</p>`;
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
