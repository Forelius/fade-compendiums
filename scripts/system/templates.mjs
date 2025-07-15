/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
   // TODO: Remove after v12 support.
   const fn = foundry?.applications?.handlebars?.loadTemplates ? foundry.applications.handlebars.loadTemplates : loadTemplates;
   await fn({});
};