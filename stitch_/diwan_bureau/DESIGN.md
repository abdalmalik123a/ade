---
name: Diwan Bureau
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2f1500'
  on-tertiary-container: '#c76c00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
  code-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-dock: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an authoritative, precision-engineered desktop environment dedicated to state-level administrative drafting, clerical offices, and legal document publishing. The aesthetic bridges the dignified heritage of official governmental correspondence with the razor-sharp efficiency of modern institutional SaaS.

### Personality & Emotional Response
- **Sovereign & Dependable:** Inspires unwavering trust, legal rigor, and procedural confidence.
- **Clerical Clarity:** Reduces cognitive fatigue during prolonged drafting sessions with high-density data visualization and uncluttered visual hierarchy.
- **Architectural Tactility:** The workspace behaves like a digital desk; forms feel purposeful, while documents reflect true physical paper geometry (margins, stamps, crests, and signatures).

### Design Style
The system adopts an **Institutional Modern** aesthetic: crisp architectural boundaries, muted slate-navy structural planes, subtle warm ivory workspace backdrops, and functional micro-textures. Visual ornament is strictly subservient to document fidelity, typographic rhythm, and rapid keyboard-driven workflows.

## Colors

The color architecture is built around three operational contexts: structural application shells, dynamic interactive states, and realistic paper simulations.

### Palette Roles
- **Primary Navy (`#0F172A` / `#1E293B`):** Establishes the authoritative application shell, primary navigation rails, high-priority typography, and official decree seals.
- **Action Blue (`#3B82F6`):** Governs active focus states, selection rings, primary interactive controls, variable insertion pills, and inline link anchors.
- **Official Amber / Gold (`#D97706`):** Reserved for governmental seals, classification banners (e.g., "سري للغاية" / "Top Secret"), urgent protocols, and archival state markers.
- **Print / Verification Emerald (`#10B981`):** Applied strictly to affirmative state actions: document validation, ready-for-print status, legal checksum confirmation, and digital stamp execution.
- **Paper & Neutral Canvas (`#FFFFFF`, `#F8FAFC`, `#F1F5F9`):** The application canvas sits on `#F1F5F9` to create subtle separation against the document sheet itself (`#FFFFFF`), simulating realistic physical weight and edge boundaries.

## Typography

Typography prioritizes bilingual institutional rigor with a core focus on **IBM Plex Sans Arabic** paired with **IBM Plex Sans** for Latin numerics and legal reference codes.

### Hierarchy & RTL Mechanics
- **Structural Text:** Application chrome, metadata sidebars, and control ribbons utilize balanced tracking and exact baseline alignment to maintain readability at condensed scales (`12px` - `14px`).
- **Document Text:** The preview engine implements formal Arabic typography standards: extended line-height (`1.75` - `2.0`) to avoid diacritic clipping (Tashkeel) and maintain legibility across complex ligatures.
- **Numerals:** Financial sums, decree reference numbers, and dates enforce tabular numerals (`font-variant-numeric: tabular-nums`) to ensure strict vertical column alignment in accounting and official rosters.

## Layout & Spacing

The layout is built for high-density desktop usage, anchored by a dual-axis workspace and split-pane architecture.

### Split-Pane Mechanics
- **Form Pane (Input Rail):** Fixed minimum width (380px to 460px), vertically scrollable, arranged in structured fieldsets with compact rhythm (`space-md` gaps).
- **Preview Canvas (A4 Virtual Platen):** Fluid center stage centered horizontally. The preview sheet adheres to fixed international paper aspect ratios (1:1.414, ISO 216 A4), maintaining standard 20mm printing margins.
- **Utility & Inspector Rail:** Collapsible right-hand panel (`space-dock`) for metadata, stamps, variable pickers, and revision histories.

### Breakpoints & Adaptability
- **Desktop Standard (1440px+):** Full three-pane workstation: Navigation + Form Input + Live A4 Canvas + Meta Rail.
- **Compact Desktop / Tablet Landscape (1024px - 1439px):** Inspector collapses into floating slide-out drawer; split ratio adapts to 45% form, 55% live preview with active zoom scaler.

## Elevation & Depth

Visual depth is achieved through **tonal stacking and low-contrast borders**, ensuring that software controls do not overpower the official paper simulation.

### Elevation Architecture
1. **Level 0 (Canvas Base - `#F1F5F9`):** Application frame and non-interactive layout troughs.
2. **Level 1 (Panels & Toolbars - `#FFFFFF`):** Work surfaces bordered by a hairline stroke (`#E2E8F0`, 1px solid) with zero shadow, conveying structured industrial stability.
3. **Level 2 (The Document Sheet):** The A4 sheet receives a multi-stage ambient sheet shadow: `0 1px 3px rgba(15, 23, 42, 0.06), 0 16px 32px -4px rgba(15, 23, 42, 0.08)`. This lifts the paper physically above the application desk.
4. **Level 3 (Dropdowns, Variable Pickers, Flyouts):** Sharp float effect with tight falloff: `0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)`, bounded by `#CBD5E1`.
5. **Level 4 (Modal Approvals & Print Dialogs):** High-importance overlays seated over a `#0F172A` scrim with 45% opacity.

## Shapes

The design system employs a **Soft Institutional (Level 1)** geometric standard. Sharp precision reflects administrative formality, while softened 4px corners prevent visual abrasiveness during long operational hours.

### Application Rules
- **Base Components (Inputs, Buttons, Cards):** Standard border radius of `0.25rem` (4px).
- **Paper Document:** Strictly `0px` radius on the virtual A4 page corners to mirror realistic physical paper trimming.
- **Variable Tokens & Pills:** `0.25rem` for bracketed systemic data tokens (`[اسم_المواطن]`).
- **Modal Containers & Elevated Drawers:** `rounded-lg` (`0.5rem` / 8px) for comfortable containment of dense administrative forms.

## Components

### Buttons
- **Primary Action (Print / Issue):** Emerald fill (`#10B981`), white text, 4px radius. In focus: 2px offset ring of `#10B981`.
- **Secondary Action (Save Draft / Export):** Deep Navy (`#0F172A`) or Outline with 1px `#CBD5E1` border, navy text, subtle hover tint (`#F8FAFC`).
- **Icon Toolbar Buttons:** 36x36px square targets with 4px radius, soft hover (`#E2E8F0`), centered SVG icons (18px).

### Variable Pills & Injection Tags
- **Appearance:** Crisp inset chips for dynamic field markers (e.g., `[رقم_الصادر]`, `[اسم_الجهة]`).
- **Styling:** Inset background of `#EFF6FF`, 1px solid `#BFDBFE`, text color `#1D4ED8`. Hover initiates an amber highlight (`#FEF3C7` border and `#B45309` text) indicating editable binding.

### Split-Pane Document Editor
- **Input Side:** Vertical form stack with fixed label heights, mandatory indicator marks (`*` in `#EF4444`), and contextual helper icons.
- **Document Paper Side:** Pure white (`#FFFFFF`) with official header zones (crest center/right, metadata block left). Watermarks ("مسودة" / "Draft") render as diagonal 12% opacity text in the background.

### Input Fields & Controls
- **Text & Area Inputs:** `#FFFFFF` background, 1px `#CBD5E1` stroke, 4px border-radius, interior padding of 8px 12px. Active focus swaps stroke to `#3B82F6` with an immediate 1px solid ring.
- **Checkboxes & Radios:** High-contrast square/circle selectors using `#0F172A` when checked; unchecked states feature an assertive `#94A3B8` perimeter to ensure visibility across diverse monitors.

### Document Archive Tables
- **Header:** Sticky `#F8FAFC` row with 1px border bottom (`#CBD5E1`), bold 12px uppercase labels.
- **Rows:** Alternating subtle zebra striping (`#FFFFFF` to `#F8FAFC`). Hover states apply `#F1F5F9`. Status columns use badge components with emerald, amber, or slate fills.