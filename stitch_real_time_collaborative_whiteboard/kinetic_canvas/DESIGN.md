---
name: Kinetic Canvas
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
  on-surface-variant: '#464554'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777585'
  outline-variant: '#c7c4d6'
  surface-tint: '#4f4ccd'
  primary: '#3f3bbd'
  on-primary: '#ffffff'
  primary-container: '#5856d6'
  on-primary-container: '#e7e4ff'
  inverse-primary: '#c2c1ff'
  secondary: '#0058bc'
  on-secondary: '#ffffff'
  secondary-container: '#0070eb'
  on-secondary-container: '#fefcff'
  tertiary: '#7c17ab'
  on-tertiary: '#ffffff'
  tertiary-container: '#9739c6'
  on-tertiary-container: '#f8deff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c2c1ff'
  on-primary-fixed: '#0c006a'
  on-primary-fixed-variant: '#3631b4'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a41'
  on-secondary-fixed-variant: '#004493'
  tertiary-fixed: '#f6d9ff'
  tertiary-fixed-dim: '#e8b3ff'
  on-tertiary-fixed: '#310048'
  on-tertiary-fixed-variant: '#7201a2'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Geist
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  toolbar-gap: 0.5rem
  panel-padding: 1rem
  touch-target: 2.5rem
  canvas-margin: 1.5rem
  grid-unit: 8px
---

## Brand & Style

The design system is engineered for a high-performance collaborative environment where the UI serves as a transparent frame for creativity. The brand personality is **Efficient, Creative, Precise, and Modern**, prioritizing utility and low cognitive load.

The visual direction follows **Modern Minimalism** with a focus on functional clarity. By utilizing expansive whitespace (or "canvas space"), the interface recedes into the periphery, allowing user-generated content to take center stage. High-contrast accents are reserved strictly for interactive states, presence indicators, and real-time collaboration signals, ensuring that "who is doing what" is immediately legible without overwhelming the workspace.

## Colors

The palette is anchored by a **Slate/Gray** neutral scale that defines the chrome and structural elements. A vibrant **Electric Purple/Blue** serves as the primary action color. 

- **Canvas:** In light mode, use a faint dot-grid (`#E2E8F0`); in dark mode, use a deep charcoal (`#0F172A`) with a muted grid (`#1E293B`).
- **Presence:** Multi-user cursors and selection borders use high-chroma Pink, Orange, Green, and Teal to distinguish contributors instantly.
- **Sticky Notes:** Utilize a "Classic Paper" palette with high legibility and low saturation to ensure black text remains readable.
- **Functional Accents:** Success, warning, and error states follow standard semantic patterns but are slightly desaturated to match the professional tone.

## Typography

This design system uses **Inter** for all primary interface elements to ensure maximum legibility at various zoom scales. **Geist** is introduced for labels and technical metadata (coordinates, zoom percentages, shortcuts) to provide a precise, developer-friendly aesthetic.

Scale is used sparingly; most of the UI lives within the `body-sm` and `label-md` ranges to preserve screen real estate. Bold weights are reserved for active states or headers within property panels. On mobile, `headline-lg` scales down to 24px to prevent layout crowding.

## Layout & Spacing

The layout utilizes a **Fixed UI Overlay** model. The canvas is infinite, while toolbars and panels float at the edges with a consistent margin from the viewport boundary.

- **Grid System:** An 8px linear grid governs all component dimensions and padding.
- **Toolbars:** Centered bottom or left, using a `0.5rem` gap between tool-groups.
- **Sidebars:** Property panels are fixed to a width of 280px on desktop, collapsing to bottom sheets on mobile.
- **Responsive Behavior:** On mobile, the main toolbar moves to the bottom of the screen for thumb-reachability, and side-panels transition to full-width overlays.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows**.

1.  **Level 0 (Canvas):** The base layer. Flat, non-interactive background.
2.  **Level 1 (Objects):** Shapes, images, and text on the canvas. These use a very subtle 1px border or a 2px "soft drop" shadow when being dragged.
3.  **Level 2 (Floating UI):** Toolbars and property panels. These use a high-diffusion, low-opacity shadow (`0 10px 25px -5px rgba(0,0,0,0.1)`) to appear as if hovering 16px above the canvas.
4.  **Level 3 (Modals/Menus):** Context menus and dialogs. These use a slightly tighter, darker shadow and a 1px neutral border for crisp definition against the floating toolbars.

In Dark Mode, elevation is communicated via surface lightness (lighter = closer) rather than heavy shadows.

## Shapes

The shape language is **Rounded**, conveying a modern and approachable feel without being overly "bubbly." 

- **Toolbars & Panels:** Use `rounded-lg` (1rem) for the main container to create a soft, floating island effect.
- **Buttons & Inputs:** Use `rounded-md` (0.5rem) to maintain a crisp, professional look within the toolbars.
- **Canvas Objects:** Default shape creation (rectangles) starts at 0px but provides a handle for users to adjust to any radius.

## Components

- **Toolbars:** Horizontal or vertical strips with a semi-transparent background (Blur: 12px). Buttons are icon-only, using a 40x40px touch target. The active tool is indicated by a primary color background with white icons.
- **Presence Cursors:** A simple arrowhead with a trailing label showing the user's name. The color is pulled from the `presence` tokens. Labels disappear after 3 seconds of inactivity.
- **Sticky Notes:** Fixed aspect ratio (1:1), utilizing the `sticky_notes` color tokens. Text is centered horizontally and vertically using `body-lg`.
- **Property Panels:** Grouped controls with thin dividers (`1px`). Use "ghost" inputs—borderless until hovered or focused—to keep the UI clean.
- **Buttons:**
    - *Primary:* Solid primary color, white text.
    - *Ghost:* No background, neutral text, primary color on hover.
- **Inputs:** Minimalist with a 1px border appearing only on focus; otherwise, a light-gray fill indicates interactivity.