/** توكنات التصميم — مُستخرجة آليًا من ملفات code.html في stitch_.
 *  لا تُعدَّل يدويًا. أعِد التوليد بـ: node tools/extract-tokens.mjs */
module.exports = {
  darkMode: "class",
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
          "colors": {
                "background": "#eef0ec",
                "on-background": "#18211d",
                "surface": "#eef0ec",
                "surface-bright": "#f6f7f4",
                "surface-dim": "#e3e6e0",
                "surface-container-lowest": "#ffffff",
                "surface-container-low": "#f6f7f4",
                "surface-container": "#eef0ec",
                "surface-container-high": "#e6e9e3",
                "surface-container-highest": "#dde1da",
                "surface-variant": "#dde1da",
                "on-surface": "#18211d",
                "on-surface-variant": "#5f6b64",
                "outline": "#7a857d",
                "outline-variant": "#e0e3dd",
                "surface-tint": "#0e7a63",
                "inverse-surface": "#26302b",
                "inverse-on-surface": "#eef0ec",
                "inverse-primary": "#8fd3c3",
                "primary": "#0e7a63",
                "on-primary": "#ffffff",
                "primary-container": "#0e7a63",
                "on-primary-container": "#ffffff",
                "primary-fixed": "#dcefe9",
                "primary-fixed-dim": "#b8ded4",
                "on-primary-fixed": "#05221c",
                "on-primary-fixed-variant": "#2f5a4f",
                "secondary": "#0e7a63",
                "on-secondary": "#ffffff",
                "secondary-container": "#0b6252",
                "on-secondary-container": "#ffffff",
                "secondary-fixed": "#dcefe9",
                "secondary-fixed-dim": "#b8ded4",
                "on-secondary-fixed": "#05221c",
                "on-secondary-fixed-variant": "#0e7a63",
                "tertiary": "#a6813a",
                "on-tertiary": "#ffffff",
                "tertiary-container": "#f3e9d6",
                "on-tertiary-container": "#6e5320",
                "tertiary-fixed": "#f3e9d6",
                "tertiary-fixed-dim": "#e2c78f",
                "on-tertiary-fixed": "#3a2c10",
                "on-tertiary-fixed-variant": "#6e5320",
                "error": "#ba1a1a",
                "on-error": "#ffffff",
                "error-container": "#ffdad6",
                "on-error-container": "#93000a"
          },
          "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "full": "0.75rem"
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
                      "IBM Plex Sans"
                ],
                "label-md": [
                      "IBM Plex Sans"
                ],
                "headline-xl": [
                      "IBM Plex Sans"
                ],
                "headline-md": [
                      "IBM Plex Sans"
                ],
                "label-sm": [
                      "IBM Plex Sans"
                ],
                "body-md": [
                      "IBM Plex Sans"
                ],
                "label-lg": [
                      "IBM Plex Sans"
                ],
                "code-sm": [
                      "IBM Plex Sans"
                ],
                "body-sm": [
                      "IBM Plex Sans"
                ],
                "headline-lg": [
                      "IBM Plex Sans"
                ],
                "body-lg": [
                      "IBM Plex Sans"
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
          }
    }
  },
  plugins: []
};
