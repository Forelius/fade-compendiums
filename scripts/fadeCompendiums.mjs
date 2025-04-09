import { preloadHandlebarsTemplates } from './system/templates.mjs';
import { FADEPACK } from "./system/config.mjs"

Hooks.once('init', async function () {
   //console.debug('FADEPACK: init hook called.');
});

Hooks.once('beforeFadeInit', async function (fadeRegistry) {
   //console.debug('FADEPACK: beforeFadeInit hook called.');
});

Hooks.once('afterFadeInit', async function (fadeRegistry) {
   //console.debug('FADEPACK: afterFadeInit hook called.');

   // Preload Handlebars templates.
   await preloadHandlebarsTemplates();
});

Hooks.once('beforeFadeReady', async function (fadeRegistry) {
   //console.debug('FADEPACK: beforeFadeReady hook called.');
});

Hooks.once('afterFadeReady', async function (fadeRegistry) {
   //console.debug('FADEPACK: afterFadeReady hook called.');
});