/** توكنات التصميم — مُستخرجة آليًا من ملفات code.html في stitch_.
 *  لا تُعدَّل يدويًا. أعِد التوليد بـ: node tools/extract-tokens.mjs */
module.exports = {
  darkMode: "class",
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
          "colors": {
                "inverse-primary": "#bec6e0",
                "surface-container-highest": "#d3e4fe",
                "surface-tint": "#565e74",
                "on-primary-container": "#7c839b",
                "tertiary-container": "#2f1500",
                "on-primary-fixed": "#131b2e",
                "tertiary-fixed": "#ffdcc3",
                "on-secondary-fixed-variant": "#004395",
                "surface": "#f8f9ff",
                "tertiary": "#000000",
                "primary": "#000000",
                "on-surface": "#0b1c30",
                "surface-container-lowest": "#ffffff",
                "on-tertiary-fixed-variant": "#6e3900",
                "tertiary-fixed-dim": "#ffb77d",
                "primary-container": "#131b2e",
                "inverse-on-surface": "#eaf1ff",
                "on-primary": "#ffffff",
                "error": "#ba1a1a",
                "inverse-surface": "#213145",
                "surface-container": "#e5eeff",
                "surface-container-low": "#eff4ff",
                "outline-variant": "#c6c6cd",
                "on-primary-fixed-variant": "#3f465c",
                "on-secondary-container": "#fefcff",
                "background": "#f8f9ff",
                "on-background": "#0b1c30",
                "on-tertiary": "#ffffff",
                "on-tertiary-container": "#c76c00",
                "on-secondary-fixed": "#001a42",
                "surface-bright": "#f8f9ff",
                "on-tertiary-fixed": "#2f1500",
                "surface-container-high": "#dce9ff",
                "surface-variant": "#d3e4fe",
                "outline": "#76777d",
                "on-error-container": "#93000a",
                "secondary": "#0058be",
                "secondary-fixed-dim": "#adc6ff",
                "error-container": "#ffdad6",
                "secondary-container": "#2170e4",
                "primary-fixed-dim": "#bec6e0",
                "secondary-fixed": "#d8e2ff",
                "on-secondary": "#ffffff",
                "surface-dim": "#cbdbf5",
                "primary-fixed": "#dae2fd",
                "on-surface-variant": "#45464d",
                "on-error": "#ffffff"
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
