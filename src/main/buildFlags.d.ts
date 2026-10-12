/**
 * أبواب الاختبار (البند ٢٥): `true` في نسخة التطوير وفي «بناء الاختبار» (`npm run pack`)، و`false` في بناء الإصدار
 * (`electron-vite build --mode release` من `npm run dist`) — فيُسقط البناء ما خلفها كلّه، ولا يبقى في البرنامج الذي يُسلَّم
 * بابٌ يُفتح بمتغيّر بيئة. يعرّفه `electron.vite.config.ts` و`vitest.config.ts`، وتتحقّق منه بوّابة الإصدار (`tools/release.mjs`).
 */
declare const __DIWAN_TEST_DOORS__: boolean;
