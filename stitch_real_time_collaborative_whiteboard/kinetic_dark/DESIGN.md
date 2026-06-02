---
name: Kinetic Dark
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff516a'
  on-tertiary-container: '#5b0017'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
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
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  gutter: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 2.5rem
---

## Brand & Style

The brand personality is high-energy, technical, and sophisticated. It is designed for fast-paced environments where data density and visual clarity must coexist. The emotional response is one of controlled power—a UI that feels like a high-performance instrument.

This design system utilizes a **Corporate Modern** foundation infused with **High-Contrast** accents. By leveraging a dark aesthetic, we minimize eye strain while allowing vibrant primary colors to pop with almost neon intensity. The style emphasizes movement through lean typography and intentional depth, ensuring the interface feels responsive and "kinetic" even in a static state.

## Colors

The palette is built upon a "Deep Charcoal" base to provide a true dark-mode experience that exceeds standard contrast requirements. 

- **Primary Surface:** The background sits at `#121212`. Layers of depth are created by stepping up in luminosity rather than adding traditional shadows.
- **Vibrant Accents:** The primary Indigo (`#6366F1`) is the main "action" color. Secondary Cyan and Tertiary Rose are used sparingly for status, differentiation, and data visualization.
- **Typography Contrast:** All body text must sit at a minimum of `85%` opacity white to ensure AA+ accessibility against the charcoal background.

## Typography

The typography system pairs the geometric boldness of **Sora** for headlines with the utilitarian precision of **Inter** for long-form reading. 

- **Headlines:** Use Sora with tight letter-spacing to create a sense of density and impact.
- **Body:** Inter provides maximum legibility across all screen sizes.
- **Monospace Accents:** JetBrains Mono is utilized for labels, metadata, and technical readouts to reinforce the high-tech, kinetic aesthetic.
- **Scale:** Larger headlines downscale by approximately 25-33% on mobile devices to maintain visual hierarchy without overwhelming the viewport.

## Layout & Spacing

This design system uses a **Fluid Grid** model based on an 8px square baseline. 

- **Grid:** A 12-column system for desktop and a 4-column system for mobile. 
- **Gutters:** Fixed at 24px (`lg`) to ensure clear separation between high-density data containers.
- **Rhythm:** Vertical spacing should follow the base-8 rule. Elements within a component use `sm` or `md`, while sections are separated by `xl`.
- **Adaptation:** On mobile, margins shrink to `1rem` to maximize usable screen real estate, while horizontal padding inside containers is halved.

## Elevation & Depth

In this dark-mode environment, depth is communicated through **Tonal Layering** and **Rim Lighting** rather than traditional drop shadows.

- **The Stack:** Surfaces closer to the user are lighter. The base is `#121212`, while an elevated card would be `#1E1E1E`.
- **Glow Effects:** High-importance elements (like active primary buttons) may utilize a subtle ambient outer glow using the primary color at 15-20% opacity.
- **Borders:** Use low-contrast outlines (`white/10%`) for standard containers. For "active" states, switch the border to the primary accent color.
- **Backdrop:** Use a 12px blur for any floating overlays or navigation bars to maintain context of the content beneath.

## Shapes

The shape language is "Softly Geometric." 

- **Core Elements:** Buttons and input fields use a `0.5rem` (8px) radius, providing a modern feel that isn't too aggressive.
- **Large Containers:** Cards and modals utilize `rounded-lg` (1rem) to create clear visual containment.
- **Utility Elements:** Tags, chips, and badges use a full pill-shape (`rounded-xl` or `999px`) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid `#6366F1` with white text. 
- **Secondary:** Outlined with a 1px border of the primary color and a subtle hover fill.
- **Ghost:** Transparent background with primary-colored text for low-priority actions.

### Inputs
- Background should be `container_low`. 
- Borders are neutral-gray until focused, at which point they transition to the primary indigo with a 2px stroke.

### Cards
- Use `container_low` for the background. 
- Apply a subtle 1px border (`white/5%`) to define the edge against the background.

### Chips & Badges
- Use the monospace label font.
- Backgrounds should be a desaturated version of the intent color (e.g., Error = Deep Red at 20% opacity with Bright Red text).

### Navigation
- Top or side navigation should use the `backdrop-blur` effect and sit at the highest elevation (`container_high`).