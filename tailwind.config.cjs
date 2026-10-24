/** توكنات التصميم — مظهر «ب٢» (ر175؛ وقبله «منتصف الليل»، خطّة الترقية، المرحلة ٦).
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
          // السماويّ حدٌّ للمختار (`border-cyan`)، والبرتقاليّ لأيقونةٍ أو نجمةٍ بجانب نصٍّ يحمل المعنى (`text-orange`).
          "borderColor": { "cyan": { "DEFAULT": "#21C8E7" } },
          "textColor": { "orange": { "DEFAULT": "#F89800" } },
          // زوايا «ورقة شجر» (ر175، «ب٢»): أعلى اليمين وأسفل اليسار أكبر، وبعضها بيضويّ.
          "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "full": "0.75rem",
                "frame": "14px 28px 14px 28px / 14px 24px 14px 24px",
                "card": "11px 22px 11px 22px / 11px 19px 11px 19px",
                "field": "9px 16px 9px 16px",
                "btn": "8px 16px 8px 16px",
                "ico": "8px 15px 8px 15px",
                "chip": "7px 14px 7px 14px"
          },
          // تدرّجات «ب٢» (ر175): الفعل من السماويّ إلى الأزرق (والنصّ الأبيض يقع على الأزرق)، والبرتقاليّ صبغةً للشارة والعدد،
          // والمختار والسطح الأبيض، والأرضية: ضوءٌ أبيض أعلى اليمين ولمسةٌ سماوية أسفل اليسار.
          "backgroundImage": {
                "grad-act": "linear-gradient(135deg,#21C8E7 0%,#0872A3 32%,#06608B 100%)",
                "grad-orange": "linear-gradient(145deg,#FFB126,#F89800)",
                "grad-sel": "linear-gradient(145deg,#FFFFFF,#F0FBFD)",
                "grad-surface": "linear-gradient(180deg,#FFFFFF,#FBFCFD)",
                "ground": "radial-gradient(900px 520px at 100% 0%,#FFFFFF 0%,rgba(255,255,255,0) 70%),radial-gradient(760px 460px at 0% 100%,#E9F7FB 0%,rgba(233,247,251,0) 70%)"
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
          // وظلال «ب٢»: محايدةٌ بلون الحبر، والفعل والمختار أزرقان خفيفان.
          "boxShadow": {
                "xs": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                "card": "0 14px 32px rgba(36,52,61,.10),0 3px 8px rgba(36,52,61,.05)",
                "soft": "0 8px 22px rgba(36,52,61,.08),inset 0 1px 0 rgba(255,255,255,.9)",
                "low": "0 2px 6px rgba(36,52,61,.06),inset 0 1px 0 rgba(255,255,255,.9)",
                "act": "0 10px 22px -8px rgba(8,114,163,.55),inset 0 1px 0 rgba(255,255,255,.28)",
                "sel": "0 12px 28px rgba(8,104,152,.12),0 2px 6px rgba(8,104,152,.08)"
          },
          "backdropBlur": {
                "xs": "4px"
          }
    }
  },
  plugins: []
};
