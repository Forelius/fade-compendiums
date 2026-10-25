const MODULE_ID = "fade-compendiums";
const FLAG_KEY = "compose";

/** Roles that identify talent/power docs for magic item composers. */
export const COMPOSE_ROLES = {
   NONE: "",
   WEAPON_TALENT: "weapon-talent",
   ARMOR_POWER: "armor-power",
   MISSILE_TALENT: "missile-talent",
   /** Future intelligent-weapon composer (primary powers). */
   INTEL_PRIMARY: "intel-primary-power",
   /** Future intelligent-weapon composer (extraordinary powers; +1 will each). */
   INTEL_EXTRAORDINARY: "intel-extraordinary-power"
};

/**
 * Module-private compose metadata on spell / special-ability items.
 */
export class ComposeFlags {
   /**
    * @returns {object}
    */
   static defaults() {
      return {
         role: COMPOSE_ROLES.NONE,
         promptOpponent: false,
         charges: null,
         unlimitedCharges: false,
         forbidCurse: false,
         action: "use",
         castAs: "",
         cost: 1,
         patches: { set: {}, multiply: {} },
         vsGroups: []
      };
   }

   /**
    * @param {Item|object|null|undefined} item Item document or plain item data
    * @returns {object}
    */
   static get(item) {
      const stored = item?.flags?.[MODULE_ID]?.[FLAG_KEY]
         ?? item?.flags?.[MODULE_ID]?.compose
         ?? null;
      const data = foundry.utils.mergeObject(ComposeFlags.defaults(), stored ?? {}, { inplace: false });
      data.patches ??= { set: {}, multiply: {} };
      data.patches.set ??= {};
      data.patches.multiply ??= {};
      // Keep patch maps as flat dotted paths (storage/merge may nest "a.b.c" keys).
      data.patches.set = foundry.utils.flattenObject(data.patches.set);
      data.patches.multiply = foundry.utils.flattenObject(data.patches.multiply);
      // Sheet convenience: expose range multiply bake as a flat field.
      if (data.rangeMultiplier == null) {
         data.rangeMultiplier = data.patches.multiply["system.mod.rangeMultiplier"] ?? null;
      }
      return data;
   }

   /**
    * Normalize sheet submit payload into stored compose flag shape.
    * @param {object} raw
    * @returns {object}
    */
   static normalize(raw) {
      const data = foundry.utils.mergeObject(ComposeFlags.defaults(), raw ?? {}, { inplace: false });
      data.patches ??= { set: {}, multiply: {} };
      data.patches.set ??= {};
      data.patches.multiply ??= {};
      const rangeMult = Number(data.rangeMultiplier);
      if (Number.isFinite(rangeMult) && rangeMult !== 0) {
         data.patches.multiply["system.mod.rangeMultiplier"] = rangeMult;
      } else {
         delete data.patches.multiply["system.mod.rangeMultiplier"];
      }
      delete data.rangeMultiplier;
      if (data.charges === "" || data.charges === undefined) data.charges = null;
      else if (data.charges != null) data.charges = Number(data.charges);
      data.cost = Math.max(1, Number(data.cost) || 1);
      data.vsGroups = Array.isArray(data.vsGroups) ? data.vsGroups : [];
      return data;
   }

   /**
    * @param {Item|object|null|undefined} item
    * @returns {string}
    */
   static role(item) {
      return ComposeFlags.get(item).role || COMPOSE_ROLES.NONE;
   }

   /**
    * @param {Item|object|null|undefined} item
    * @param {string} role
    * @returns {boolean}
    */
   static hasRole(item, role) {
      return ComposeFlags.role(item) === role;
   }

   /**
    * Collect item-pack documents with the given compose role.
    * @param {string} role
    * @returns {Promise<Item[]>}
    */
   static async findByRole(role) {
      const pack = game.packs.get("fade-compendiums.item-compendium");
      if (!pack) return [];
      const docs = await pack.getDocuments();
      return docs.filter((doc) => ComposeFlags.hasRole(doc, role));
   }
}

export { MODULE_ID as COMPOSE_MODULE_ID, FLAG_KEY as COMPOSE_FLAG_KEY };
