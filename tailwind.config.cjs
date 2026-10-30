/** توكنات التصميم — العسلي والسيان (ر192؛ D241).
 *  الألوان تُكتب يدويًّا في src/shared/theme.ts، وهنا أسماء أدوارها وحدها (يطابقها tests/theme.test.ts)، والتدرّجات والظلال والزوايا.
 *  وتوليدها من stitch_ توقّف. والمقاسات والخطوط كما كانت. */
const ROLES = [
  'background',
  'on-background',
  'surface',
  'surface-bright',
  'surface-dim',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'surface-variant',
  'on-surface',
  'on-surface-variant',
  'outline',
  'outline-variant',
  'surface-tint',
  'inverse-surface',
  'inverse-on-surface',
  'inverse-primary',
  'primary',
  'on-primary',
  'primary-container',
  'on-primary-container',
  'primary-fixed',
  'primary-fixed-dim',
  'on-primary-fixed',
  'on-primary-fixed-variant',
  'secondary',
  'on-secondary',
  'secondary-container',
  'on-secondary-container',
  'secondary-fixed',
  'secondary-fixed-dim',
  'on-secondary-fixed',
  'on-secondary-fixed-variant',
  'tertiary',
  'on-tertiary',
  'tertiary-container',
  'on-tertiary-container',
  'tertiary-fixed',
  'tertiary-fixed-dim',
  'on-tertiary-fixed',
  'on-tertiary-fixed-variant',
  'error',
  'on-error',
  'error-container',
  'on-error-container',
  'scrim'
];

module.exports = {
  darkMode: "class",
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
          // الألوان أدوارٌ متغيّراتها في الصفحة (`src/shared/theme.ts`) — فالمظهر الليلي والنهاري بلا إعادة بناء.
          "colors": Object.fromEntries(ROLES.map((r) => [r, `rgb(var(--c-${r}) / <alpha-value>)`])),
          // وصبغتا «ب٢» (ر175) لا دوران — فليستا في `colors` (الأدوار وحدها، يطابقها tests/theme.test.ts):
          // السيان حد المختار؛ العسلي لأيقونة أو عدد بجانب نص يحمل المعنى، لا لنص على الأبيض.
          "borderColor": { "cyan": { "DEFAULT": "rgb(var(--i-cyan))" } },
          "textColor": { "orange": { "DEFAULT": "rgb(var(--i-honey))" } },
          // زوايا منتظمة كما في النموذج المعتمد (ر192)، بلا تغيير المقاسات أو الحشو.
          "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "full": "0.75rem",
                "frame": "12px",
                "card": "9px",
                "field": "8px",
                "btn": "8px",
                "ico": "8px",
                "chip": "7px"
          },
          // العسلي للفعل بنص كحلي؛ السيان للتحديد؛ الأسطح بيضاء والأرضية موحّدة (ر192).
          "backgroundImage": {
                "grad-act": "linear-gradient(165deg,rgb(var(--i-honey-light)),rgb(var(--i-honey)))",
                "grad-orange": "linear-gradient(165deg,rgb(var(--i-honey-light)),rgb(var(--i-honey)))",
                "grad-sel": "linear-gradient(145deg,#FFFFFF,#EDF8FA)",
                "grad-surface": "linear-gradient(180deg,#FFFFFF,#FFFFFF)",
                "ground": "linear-gradient(#F3F5F7,#F3F5F7)"
          },
          "spacing": {
                "space-xs": "0.25rem",
                "margin": "1.5rem",
                "gutter": "1rem",
                "space-md": "1rem",
                "space-lg": "1.5rem",
                "space-sm": "0.5rem",
                "gutter-compact": "0.5rem",
                "space-xl": "2rem",
                "margin-dock": "0.75rem"
          },
          "fontFamily": {
                "headline-sm": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "label-md": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "headline-xl": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "headline-md": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "label-sm": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "label-xs": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "body-md": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "label-lg": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "code-sm": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "body-sm": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "headline-lg": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ],
                "body-lg": [
                      "IBM Plex Sans Arabic",
                      "IBM Plex Sans",
                      "sans-serif"
                ]
          },
          "fontSize": {
                "headline-sm": [
                      "16px",
                      {
                            "lineHeight": "24px",
                            "fontWeight": "600"
                      }
                ],
                "label-md": [
                      "12px",
                      {
                            "lineHeight": "18px",
                            "fontWeight": "500"
                      }
                ],
                "headline-xl": [
                      "32px",
                      {
                            "lineHeight": "44px",
                            "fontWeight": "700"
                      }
                ],
                "headline-md": [
                      "20px",
                      {
                            "lineHeight": "30px",
                            "fontWeight": "600"
                      }
                ],
                "label-sm": [
                      "11px",
                      {
                            "lineHeight": "16px",
                            "fontWeight": "600"
                      }
                ],
                // أصغر الأوسمة (عدّاد صغير، شرح تحت خانة) — وكانت الشاشات تكتب `label-xs` ولا تعريف له فيُهمل.
                "label-xs": [
                      "10px",
                      {
                            "lineHeight": "14px",
                            "fontWeight": "500"
                      }
                ],
                "body-md": [
                      "14px",
                      {
                            "lineHeight": "24px",
                            "fontWeight": "400"
                      }
                ],
                "label-lg": [
                      "14px",
                      {
                            "lineHeight": "20px",
                            "fontWeight": "500"
                      }
                ],
                "code-sm": [
                      "12px",
                      {
                            "lineHeight": "18px",
                            "fontWeight": "400"
                      }
                ],
                "body-sm": [
                      "12px",
                      {
                            "lineHeight": "20px",
                            "fontWeight": "400"
                      }
                ],
                "headline-lg": [
                      "24px",
                      {
                            "lineHeight": "36px",
                            "fontWeight": "600"
                      }
                ],
                "body-lg": [
                      "16px",
                      {
                            "lineHeight": "28px",
                            "fontWeight": "400"
                      }
                ]
          },
          // `shadow-xs` و`backdrop-blur-xs` من Tailwind 4 — وهنا Tailwind 3: بلا تعريفهما يُهملان صامتين.
          // ظلال قصيرة؛ دفء خفيف للفعل، وسيان هادئ للمختار (ر192).
          "boxShadow": {
                "xs": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                "card": "0 3px 10px rgb(18 50 77 / .06),0 1px 3px rgb(18 50 77 / .03)",
                "soft": "0 2px 7px rgb(18 50 77 / .04),inset 0 1px 0 rgb(255 255 255 / .9)",
                "low": "0 2px 4px rgb(18 50 77 / .03),inset 0 1px 0 rgb(255 255 255 / .9)",
                "act": "inset 0 1px 0 rgb(255 255 255 / .5),0 3px 6px rgb(175 121 32 / .14)",
                "sel": "0 2px 7px rgb(36 94 105 / .08)"
          },
          "backdropBlur": {
                "xs": "4px"
          }
    }
  },
  plugins: []
};
