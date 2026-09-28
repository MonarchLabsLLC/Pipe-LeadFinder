---
name: PipeLeads Suite
version: 1.0
updated: 2026-09-27
source: PipeLeadsSuite/src/app/globals.css
description: >-
  The one visual system for the PipeLeads family and its sister apps: PipeLeads
  CRM and ProjectBaser (PipeLeads Suite), PipeLeads Lead Finder, Calendar Bug,
  DocSigner and Invoicer. A quiet light workspace, a dark violet-navy sidebar in
  both themes, one violet primary, Inter for everything and JetBrains Mono for
  numbers and code.
colors:
  primary: "#7947e0"
  on-primary: "#ffffff"
  background: "#f8f9fa"
  on-background: "#1a191e"
  surface: "#ffffff"
  on-surface: "#1a191e"
  surface-muted: "#f3f4f6"
  on-surface-muted: "#686f7d"
  accent: "#f5f3ff"
  on-accent: "#7c3aed"
  border: "#e5e7eb"
  input-border: "#8b8f96"
  ring: "#835cde"
  destructive: "#d2232c"
  success: "#007935"
  warning: "#836100"
  info: "#006cab"
  danger: "#c31a26"
  sidebar: "#2d283e"
  on-sidebar: "#f8f9fa"
  sidebar-accent: "#4c4466"
  sidebar-muted: "#a2a2b7"
  dark-background: "#0f172a"
  dark-surface: "#1e293b"
  dark-primary: "#b59fff"
  dark-sidebar: "#020617"
typography:
  font-sans: "Inter, sans-serif"
  font-mono: "JetBrains Mono, monospace"
  page-title: { fontFamily: "{typography.font-sans}", fontSize: 24px, fontWeight: 700, lineHeight: 32px, letterSpacing: -0.035em }
  dialog-title: { fontFamily: "{typography.font-sans}", fontSize: 18px, fontWeight: 600, lineHeight: 18px, letterSpacing: -0.01em }
  card-title: { fontFamily: "{typography.font-sans}", fontSize: 16px, fontWeight: 600, lineHeight: 16px, letterSpacing: -0.01em }
  body: { fontFamily: "{typography.font-sans}", fontSize: 14px, fontWeight: 400, lineHeight: 20px, letterSpacing: -0.01em }
  label: { fontFamily: "{typography.font-sans}", fontSize: 14px, fontWeight: 500, lineHeight: 14px, letterSpacing: -0.01em }
  caption: { fontFamily: "{typography.font-sans}", fontSize: 12px, fontWeight: 400, lineHeight: 16px, letterSpacing: -0.01em }
  group-label: { fontFamily: "{typography.font-sans}", fontSize: 12px, fontWeight: 500, lineHeight: 16px, letterSpacing: -0.01em }
  numeric: { fontFamily: "{typography.font-sans}", fontVariantNumeric: tabular-nums }
  code: { fontFamily: "{typography.font-mono}", fontSize: 12px }
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  unit: 4px
  control-height: 36px
  control-height-sm: 32px
  control-height-lg: 40px
  header-height: 64px
  page-padding: 24px
  section-gap: 24px
  card-padding: 24px
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.md}", height: 36px, padding: 0 16px }
  button-outline: { backgroundColor: "{colors.background}", textColor: "{colors.on-background}", borderColor: "{colors.border}", rounded: "{rounded.md}", height: 36px }
  button-ghost: { backgroundColor: transparent, hoverBackgroundColor: "{colors.accent}", textColor: "{colors.on-background}", rounded: "{rounded.md}" }
  input: { backgroundColor: transparent, borderColor: "{colors.input-border}", rounded: "{rounded.md}", height: 36px, padding: 0 12px }
  card: { backgroundColor: "{colors.surface}", borderColor: "{colors.border}", rounded: "{rounded.xl}", padding: 24px 0, shadow: sm }
  badge: { rounded: "{rounded.full}", padding: 2px 8px, fontSize: 12px, fontWeight: 500 }
  dialog: { backgroundColor: "{colors.background}", borderColor: "{colors.border}", rounded: "{rounded.lg}", padding: 24px, shadow: lg, maxWidth: 512px }
  sidebar: { backgroundColor: "{colors.sidebar}", textColor: "{colors.on-sidebar}", activeBackgroundColor: "{colors.sidebar-accent}", width: 256px, collapsedWidth: 48px }
  header: { backgroundColor: "{colors.background}", borderBottom: "{colors.border}", height: 64px }
  toast: { backgroundColor: "{colors.surface}", borderColor: "{colors.border}", position: bottom-right }
---

# PipeLeads Suite Design System

This file is the design system for every app in the PipeLeads family and its
sister apps. The tokens in the front matter above are for tools, as hex. The
source of truth is PipeLeads Suite's `src/app/globals.css`, in OKLCH, and the
appendices at the end of this file copy it exactly. When this file and that
stylesheet disagree, the stylesheet wins. Fix this file.

| App | Repository | Where it stands |
|---|---|---|
| PipeLeads CRM + ProjectBaser (PipeLeads Suite) | `MonarchLabsLLC/PipeLeadsSuite` | The reference implementation. |
| PipeLeads Lead Finder | `MonarchLabsLLC/Pipe-LeadFinder` | Tokens, shell and pages all match (September 2026). |
| Calendar Bug | `MonarchLabsLLC/CalendarBug` | Theme layer: tokens, fonts and shell colours. |
| DocSigner | `MonarchLabsLLC/DocSigner-ai` | Theme layer: tokens, fonts and shell colours. |
| Invoicer | `MonarchLabsLLC/invoicing` | Theme layer for the `invoicer` brand only. |

"Theme layer" means the apps wear this system the way a WordPress site wears a
new theme. Colours, type, corners, shadows and the sidebar and header look
change. Page structure, wizards, flows and behaviour stay as they are. Pages
that still hard-code Tailwind palette colours (`bg-blue-600`) keep those colours
until someone moves them onto tokens. Doing that is the second phase, one page
at a time.

## Overview

The look is a quiet workspace: a near-white page, white cards with a hairline
border and a soft shadow, and one saturated colour, violet, kept for the thing
you are meant to press. The sidebar is the one dark surface. It is a deep
violet-navy in the light theme and near-black navy in the dark theme, so the
product reads the same way in both. Nothing is decorated. Hierarchy comes from
type weight, spacing and that single accent.

Principles, in order of priority:

1. **Tokens only.** Every colour comes from a CSS variable. No palette classes
   (`bg-green-600`), no hex in components, no `hsl()` wrapped around an OKLCH
   variable.
2. **One accent.** `primary` marks the main action on a screen and the current
   place in navigation. Everything else is neutral or carries a status meaning.
3. **Status is semantic.** Success, warning, info and danger have their own
   tokens and read the same in both themes. They are not the accent.
4. **Both themes are designed.** Every token has a light and a dark value.
   Never style a component inside a `.dark` block. Change the token.
5. **Contrast is measured.** Text is 4.5:1 on its background in both themes, and
   control borders and focus rings are 3:1. The Suite checks this in
   `src/lib/color/theme-contrast.test.ts`.

## Colors

All values are OKLCH in the source. Hex is shown for reference and is the sRGB
conversion; a few status colours sit just outside sRGB and are mapped in by
lowering chroma.

### Core (light / dark)

| Token | Role | Light | Dark |
|---|---|---|---|
| `background` | Page ground | `#f8f9fa` | `#0f172a` |
| `foreground` | Body text on `background` | `#1a191e` | `#f8fafc` |
| `card` / `popover` | Raised surfaces, menus, dialogs | `#ffffff` | `#1e293b` |
| `primary` | The main action, the current place | `#7947e0` | `#b59fff` |
| `primary-foreground` | Text on `primary` | `#ffffff` | `#0f172a` |
| `secondary` | Secondary buttons, quiet fills | `#f3f4f6` | `#334155` |
| `muted` | Muted fills, table headers | `#f3f4f6` | `#1e293b` |
| `muted-foreground` | Descriptions, captions, placeholders | `#686f7d` | `#94a3b8` |
| `accent` | Hover and selected fills | `#f5f3ff` | `#4c1d95` |
| `accent-foreground` | Text on `accent` | `#7c3aed` | `#f8fafc` |
| `destructive` | Delete and irreversible actions | `#d2232c` | `#991b1b` |
| `border` | Hairlines, card and table borders | `#e5e7eb` | `#404e63` |
| `input` | Form control borders (3:1) | `#8b8f96` | `#64748a` |
| `ring` | Focus ring | `#835cde` | `#a78bfa` |

`border` is deliberately soft and does not reach 3:1. A form control's
boundary uses `input`, which does.

### Sidebar (dark in both themes)

| Token | Light theme | Dark theme |
|---|---|---|
| `sidebar` | `#2d283e` | `#020617` |
| `sidebar-foreground` | `#f8f9fa` | `#f8fafc` |
| `sidebar-primary` | `#7947e0` | `#a78bfa` |
| `sidebar-accent` (hover, active row) | `#4c4466` | `#1e293b` |
| `sidebar-border` | `#4c4466` | `#334155` |
| `sidebar-muted-foreground` (group labels, sub-lines) | `#a2a2b7` | `#a2a2b7` |
| `sidebar-ring` | `#a78bfa` | `#a78bfa` |
| `suite-nav-header` (Client Services Suite title band) | `#1c1829` | `#01040f` |
| `suite-nav-panel` (Client Services Suite panel) | `#3a3450` | `#141c2e` |
| `suite-nav-hover` (row hover on that panel) | `#4c4466` | `#2a3650` |

Because the sidebar is dark in both themes, `muted-foreground` is unreadable on
it. Secondary text inside the sidebar uses `sidebar-muted-foreground`.

### Status

Each has a `-foreground` for text on a solid fill. For a soft badge, use the
colour as text on a 10–15% tint of itself (`bg-success/10 text-success`).

| Token | Light | Dark |
|---|---|---|
| `success` | `#007935` | `#5ec077` |
| `warning` | `#836100` | `#e0af3b` |
| `info` | `#006cab` | `#5db2f7` |
| `danger` | `#c31a26` | `#fc7a73` |

On dark, the fills get lighter, so the paired foreground turns dark.

### Categorical

For colours a person picks or that tell records apart: pipeline stages, labels,
calendars, event types, document field types, avatars and board backgrounds.
Hues are spread evenly. Lightness is held low enough that `cat-foreground`
stays legible on a solid fill.

`cat-blue`, `cat-teal`, `cat-violet`, `cat-pink`, `cat-orange`, `cat-indigo`,
`cat-green`, `cat-red`, `cat-slate`, `cat-yellow`, and `cat-foreground` for text
on any of them.

### Charts

`chart-1` to `chart-5`: violet, pink, fuchsia, indigo, rose. Series take them
in order. Chart text, gridlines and axes use `muted-foreground` and `border`.

## Typography

- **Inter** for everything a person reads. **JetBrains Mono** for code, IDs,
  keyboard hints and fixed-width figures. Load both from Google Fonts (or
  `next/font` in Next.js apps) and declare the fallbacks `sans-serif` and
  `monospace`.
- Base tracking is `-0.01em` on `body`. Headings tighten further
  (`tracking-tight`).
- Digits that line up (tables, totals, KPI tiles, times) use
  `font-variant-numeric: tabular-nums`. The Suite sets it on every `th` and
  `td`.

| Role | Size / line | Weight | Tailwind |
|---|---|---|---|
| Page title (the one `h1`) | 24 / 32 | 700 | `text-2xl font-bold tracking-tight text-balance` |
| Dialog title | 18 | 600 | `text-lg font-semibold leading-none` |
| Card title | 16 | 600 | `leading-none font-semibold` |
| Body | 14 / 20 | 400 | `text-sm` |
| Label, button | 14 | 500 | `text-sm font-medium` |
| Description, caption | 14 or 12 | 400 | `text-sm text-muted-foreground` |
| Badge, sidebar group label | 12 | 500 | `text-xs font-medium` |
| Keyboard hint | 10 | 500 | `font-mono text-[10px]` |

Descriptions are one sentence, capped at `max-w-prose`. There is no display
serif in the product.

## Layout

- **Shell:** a sidebar on the left, a 64px header across the top of the content
  column, and `<main>` scrolling on its own under the header. The shell is fixed
  to the viewport (`h-svh`). Wide or tall content scrolls inside `main` and
  never stretches the header.
- **Page:** `p-6` on the page's container, sections stacked with
  `flex flex-col gap-6`. Settings-style pages cap their column at `max-w-5xl`.
- **Page header:** the `PageHeader` pattern. A title, one line of description,
  and the actions on the right from `sm` up; below `sm` the actions drop under
  the title and stretch.
- **Spacing:** the 4px Tailwind scale. Siblings are spaced with `gap-*` on a
  flex or grid parent, not with margins.
- **Breakpoints:** Tailwind defaults. Below `md` the sidebar becomes an
  off-canvas sheet. Between `md` and `lg` it may collapse to icons.
- **Touch:** at least 44×44px targets on touch layouts, and no controls that
  only show on hover.

## Elevation & Depth

Depth is mostly border plus a very soft shadow. In light mode the shadow is a
2px/10px blur at 3–5% black. In dark mode it is heavier (4px/12px at 20–40%),
because a light shadow disappears on navy.

| Level | Used for |
|---|---|
| none | Page ground, table rows |
| `shadow-xs` | Inputs, outline buttons |
| `shadow-sm` | Cards |
| `shadow-md` | Dropdowns, popovers |
| `shadow-lg` | Dialogs, sheets |
| `shadow-2xl` | Command palette |

## Shapes

`--radius` is `0.5rem` (8px). The scale is derived from it:

| Token | Value | Used for |
|---|---|---|
| `rounded-sm` | 4px | Checkboxes, small chips |
| `rounded-md` | 6px | Buttons, inputs, selects, menu items |
| `rounded-lg` | 8px | Dialogs, popovers, the app tile |
| `rounded-xl` | 12px | Cards |
| `rounded-full` | pill | Badges, avatars, the active-app dot |

Do not set a global corner override (such as `* { border-radius: 4px }`).

## Components

The components are shadcn/ui, "new-york" style, with lucide icons at
`size-4`. Each app keeps its own copies in `components/ui/`; what must match is
the look below.

**Buttons.** Height 36 (`sm` 32, `lg` 40, icon buttons square), `rounded-md`,
`text-sm font-medium`, a 16px icon with a gap of 8. The variants:

- `default` is `primary` (hover at 90%).
- `outline` is `background` with `border` and `shadow-xs`, and `accent` on hover.
- `secondary` is `secondary`.
- `ghost` is transparent until hover.
- `destructive` is `destructive` with white text.
- `link` is `primary` text, underlined on hover.

The focus ring is 3px `ring` at 50%. Disabled is 50% opacity.

**Inputs and selects.** Height 36, `rounded-md`, 1px `input` border, a
transparent ground (`input` at 30% in dark), `shadow-xs`, and the same 3px focus
ring. Labels sit above the field and are joined to it with `htmlFor`.

**Cards.** `card` ground, 1px `border`, `rounded-xl`, `shadow-sm`, 24px of
vertical padding and 24px of side padding in each section. A card is a
container for one thing. Do not nest cards.

**Badges.** A pill with `text-xs font-medium`. Status uses the tinted status
tokens. Neutral uses `secondary`, and counts use `outline`.

**Tables.** Inside a bordered `bg-card` container with `rounded-xl`. Headers are
`text-muted-foreground`, rows are separated by a `border` hairline, and figures
use tabular numbers. Below `sm`, lists switch to cards.

**Dialogs and sheets.** A `background` ground, `rounded-lg`, 24px padding and
`shadow-lg`. They fade in and scale from 95%. A dialog is at most `max-w-lg`
unless it holds a form or a table.

**Toasts.** Sonner, bottom-right, with a close button, on `popover` with a
`border`. The words say what happened ("Deal created"). Toasts carry no palette
colours.

**Empty, error and loading states.** Each is one designed pattern:

- Empty is an icon in a muted circle, one line saying what goes here, and the
  action that fills it.
- Error says what went wrong and offers Retry.
- Loading is a skeleton in the shape of the content, never a lone spinner for a
  page.

### The shell

**Sidebar** (shadcn `ui/sidebar`, `collapsible="icon"`, 256px open, 48px
collapsed):

1. The app identity block at the top: a 32px `rounded-lg` tile in `primary`
   with the app's lucide icon in `primary-foreground`, the app or workspace
   name in `font-semibold`, and a sub-line in `sidebar-muted-foreground`.
2. **Client Services Suite** section, a collapsible accordion that is the same
   in every app of the family: PipeLeads CRM, Lead Finder, ProjectBaser,
   CalendarBug, Invoicer and DocSigner, always in that order. It is drawn as one
   `rounded-lg`, `overflow-hidden` block inside the sidebar's side padding: a
   title band in `suite-nav-header` (32–36px high, `px-3`, "Client Services
   Suite" in the group-label style, `text-xs font-medium` in
   `sidebar-muted-foreground`, brightening to `sidebar-foreground` on hover,
   with a small chevron on the right that turns when the section closes) over a
   panel in `suite-nav-panel` (`p-1`) holding the six rows. Rows on the panel
   hover to `suite-nav-hover`, not `sidebar-accent`, which is too close to the
   panel in dark mode. Closed, the band alone is fully rounded. The band is the
   toggle; the section is open by default and the viewer's choice is remembered
   in localStorage under `suite-apps-nav-open` (`"1"` or `"0"`). Collapsed to
   icons, the band hides and the six icons stay on the panel colour as one
   rounded block, each with its tooltip. The current app is `font-semibold` and
   marked with a 6px `bg-primary` dot on the right, with no fill: the filled
   highlight belongs to the page, so two rows never compete for "you are here".
   The list lives in `src/components/sidebar/suite-apps.ts`.
3. A separator, then the app's own groups. Group labels are `text-xs
   font-medium` in `sidebar-muted-foreground`.
4. Rows are 32px high with a 16px icon. Hover and active use `sidebar-accent`.
   Active is also `font-medium`.
5. A rail on the edge toggles collapse.

**Header** (`h-16`, `border-b`, `bg-background`, padding `px-3 sm:px-4`):

1. On the left: the sidebar trigger, the ScalePlus app launcher anchor (the
   launcher's "Apps" pill is drawn just right of it, with `mr-28` reserved), a
   vertical separator and the breadcrumb (hidden below `sm`).
2. On the right: the agent button where the app has one, then a search pill
   (outline, "Search…" plus a `⌘K` hint), notifications, the theme toggle (a
   ghost sun or moon icon button) and the avatar menu.

**App tile and favicon.** A rounded square with a 135° gradient from `#7c3aed`
to `#6d28d9`, carrying the app's white lucide glyph.

## Motion

Short and functional: 100ms for hovers, 200ms for reveals and dialogs, 300ms at
most. Dialogs fade and scale from 95%, dropdowns fade and slide, toasts slide
in, and skeletons shimmer. `prefers-reduced-motion` collapses all of it to an
instant change. The Suite's `globals.css` has the rule.

## Do's and Don'ts

- **Do** use `bg-primary`, `text-muted-foreground`, `bg-success/10
  text-success` and `bg-cat-violet`.
- **Don't** use `bg-purple-600`, `text-gray-500`, `#7B61FF`, or a gradient on a
  button or a card.
- **Do** change a token when something looks wrong in dark mode.
- **Don't** add `dark:bg-slate-900` to a component.
- **Do** use `var(--primary)` in CSS written by hand.
- **Don't** write `hsl(var(--primary))` in an OKLCH app. It is invalid and
  renders nothing.
- **Do** keep one primary button per screen region.
- **Don't** put violet on every link, icon and heading.
- **Do** mark state with form as well as colour: a badge, a dot, an icon.
- **Don't** rely on red against green alone.
- **Do** keep marketing sites on their own scoped styles.
- **Don't** let product tokens leak into a `.marketing-site` scope, or the
  reverse.

## Adopting this system in another app

This is the "switch the theme" recipe. It changes how an app looks, not how it
works.

1. **Tokens.** Replace the app's `:root` and `.dark` colour variables with the
   ones in the appendix. Keep the variable names shadcn already uses, and add
   the Suite's extra ones (`sidebar-muted-foreground`, the status and
   categorical tokens). Pick the appendix that matches how the app's Tailwind
   config reads its variables:
   - Tailwind 4 (`@theme inline`), or Tailwind 3 mapping `var(--x)` to a full
     colour: use **Appendix A (OKLCH)** as is.
   - Tailwind 3 mapping `hsl(var(--x))` or `hsl(var(--x) / <alpha-value>)` to
     channel triplets: use **Appendix B (HSL triplets)**. It is the sRGB
     conversion of Appendix A.
2. **Radius and shadows.** Set `--radius: 0.5rem` and copy the shadow scale
   from the Suite's `globals.css`.
3. **Fonts.** Inter and JetBrains Mono, mapped to `--font-sans` and
   `--font-mono`.
4. **Legacy aliases.** If the app has its own brand variables or utility
   classes (`primary-purple`, `deep-navy`, `gradient-primary`), point them at
   the Suite's tokens instead of deleting them. The markup keeps working and
   takes on the new look. Keep a token's meaning in that app. Invoicer, for
   example, uses `--accent` as a strong second brand colour with white text on
   it, so under its `invoicer` brand `accent` is the Suite's deep violet
   `#7c3aed` rather than the Suite's pale hover tint.
5. **Tailwind mapping.** Map the new tokens (`sidebar-muted-foreground`,
   `success`, `warning`, `info`, `danger`, `cat-*`) in the Tailwind config, so
   pages can start using them. In a Tailwind 3 app whose variables hold full
   `oklch()` colours, map each colour through a small `token()` helper. Without
   it, Tailwind 3 silently drops opacity modifiers such as `bg-primary/10`. The
   helper returns `var(--x)`, or `color-mix(in oklch, var(--x) N%, transparent)`
   when there is a modifier. It lives in Calendar Bug's and DocSigner's
   `tailwind.config.ts`:

   ```ts
   function token(name: string) {
     return ({ opacityValue }: { opacityValue?: string | number }) => {
       const alpha = opacityValue === undefined ? undefined : String(opacityValue)
       return alpha === undefined || alpha.startsWith("var(--tw-")
         ? `var(--${name})`
         : `color-mix(in oklch, var(--${name}) calc(${alpha} * 100%), transparent)`
     }
   }
   ```
6. **Shell.** Restyle the sidebar and header to the look above using the
   `sidebar-*` tokens. Keep the app's own navigation items and behaviour.
7. **Dark mode.** Enable a toggle only once the signed-in pages are mostly on
   tokens. Until then the app stays light, and the dark tokens are ready for
   when it is.
8. **Leave alone.** Marketing sites that have their own scoped stylesheet.
   Anything a customer receives, such as PDFs and emails, and each account's own
   branding on public pages (a booking page's brand colour, for example). Those
   are the customer's look, not the product's.

## Appendix A: tokens in OKLCH (the source)

Copied from PipeLeads Suite `src/app/globals.css`. Use these as full colour values (`--primary: oklch(...)`, read as `var(--primary)`).

```css
:root {
  --background: oklch(0.9816 0.0017 247.8390);
  --foreground: oklch(0.2167 0.0098 294.7400);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.2167 0.0098 294.7400);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.2167 0.0098 294.7400);
  --primary: oklch(0.5420 0.2189 292.7172);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9670 0.0029 264.5419);
  --secondary-foreground: oklch(0.2781 0.0296 256.8480);
  --muted: oklch(0.9670 0.0029 264.5419);
  --muted-foreground: oklch(0.5400 0.0234 264.3637);
  --accent: oklch(0.9691 0.0161 293.7558);
  --accent-foreground: oklch(0.5413 0.2466 293.0090);
  --destructive: oklch(0.5580 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9276 0.0058 264.5313);
  --input: oklch(0.6480 0.0120 264.5313);
  --ring: oklch(0.5800 0.1900 293.5412);
  --chart-1: oklch(0.6056 0.2189 292.7172);
  --chart-2: oklch(0.6559 0.2118 354.3084);
  --chart-3: oklch(0.6668 0.2591 322.1499);
  --chart-4: oklch(0.5854 0.2041 277.1173);
  --chart-5: oklch(0.6450 0.2154 16.4393);
  --sidebar: oklch(0.2925 0.0399 294.2254);
  --sidebar-foreground: oklch(0.9816 0.0017 247.8390);
  --sidebar-primary: oklch(0.5420 0.2189 292.7172);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.4092 0.0568 294.5601);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.4092 0.0568 294.5601);
  --sidebar-muted-foreground: oklch(0.7200 0.0300 286);
  --sidebar-ring: oklch(0.7090 0.1592 293.5412);
  --suite-nav-header: oklch(0.2223 0.0330 294.3606);
  --suite-nav-panel: oklch(0.3439 0.0487 293.5051);
  --suite-nav-hover: oklch(0.4092 0.0568 294.5601);
  --success: oklch(0.5020 0.1400 150);
  --success-foreground: oklch(1.0000 0 0);
  --warning: oklch(0.5150 0.1400 85);
  --warning-foreground: oklch(1.0000 0 0);
  --info: oklch(0.5120 0.1500 245);
  --info-foreground: oklch(1.0000 0 0);
  --danger: oklch(0.5250 0.2000 25);
  --danger-foreground: oklch(1.0000 0 0);
  --cat-blue: oklch(0.5580 0.1700 255);
  --cat-teal: oklch(0.5320 0.1200 205);
  --cat-violet: oklch(0.5760 0.2100 293);
  --cat-pink: oklch(0.5820 0.2100 354);
  --cat-orange: oklch(0.5680 0.1600 55);
  --cat-indigo: oklch(0.5680 0.1900 275);
  --cat-green: oklch(0.5400 0.1400 150);
  --cat-red: oklch(0.5800 0.2100 25);
  --cat-slate: oklch(0.5540 0.0300 260);
  --cat-yellow: oklch(0.5560 0.1500 85);
  --cat-foreground: oklch(0.9900 0 0);
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.2077 0.0398 265.7549);
  --foreground: oklch(0.9842 0.0034 247.8575);
  --card: oklch(0.2795 0.0368 260.0310);
  --card-foreground: oklch(0.9842 0.0034 247.8575);
  --popover: oklch(0.2795 0.0368 260.0310);
  --popover-foreground: oklch(0.9842 0.0034 247.8575);
  --primary: oklch(0.7600 0.1500 293.5412);
  --primary-foreground: oklch(0.2077 0.0398 265.7549);
  --secondary: oklch(0.3717 0.0392 257.2870);
  --secondary-foreground: oklch(0.9842 0.0034 247.8575);
  --muted: oklch(0.2795 0.0368 260.0310);
  --muted-foreground: oklch(0.7107 0.0351 256.7878);
  --accent: oklch(0.3796 0.1783 293.7446);
  --accent-foreground: oklch(0.9842 0.0034 247.8575);
  --destructive: oklch(0.4437 0.1613 26.8994);
  --destructive-foreground: oklch(0.9842 0.0034 247.8575);
  --border: oklch(0.4200 0.0392 257.2870);
  --input: oklch(0.5540 0.0392 257.2870);
  --ring: oklch(0.7090 0.1592 293.5412);
  --chart-1: oklch(0.7090 0.1592 293.5412);
  --chart-2: oklch(0.7253 0.1752 349.7607);
  --chart-3: oklch(0.7477 0.2070 322.1604);
  --chart-4: oklch(0.6801 0.1583 276.9349);
  --chart-5: oklch(0.7192 0.1690 13.4280);
  --sidebar: oklch(0.1288 0.0406 264.6952);
  --sidebar-foreground: oklch(0.9842 0.0034 247.8575);
  --sidebar-primary: oklch(0.7090 0.1592 293.5412);
  --sidebar-primary-foreground: oklch(0.2077 0.0398 265.7549);
  --sidebar-accent: oklch(0.2795 0.0368 260.0310);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.3717 0.0392 257.2870);
  --sidebar-muted-foreground: oklch(0.7200 0.0300 286);
  --sidebar-ring: oklch(0.7090 0.1592 293.5412);
  --suite-nav-header: oklch(0.1094 0.0315 260.7256);
  --suite-nav-panel: oklch(0.2283 0.0371 265.3053);
  --suite-nav-hover: oklch(0.3345 0.0490 264.8904);
  --success: oklch(0.7300 0.1400 150);
  --success-foreground: oklch(0.1800 0.0300 150);
  --warning: oklch(0.7800 0.1400 85);
  --warning-foreground: oklch(0.2200 0.0400 85);
  --info: oklch(0.7400 0.1300 245);
  --info-foreground: oklch(0.1800 0.0400 245);
  --danger: oklch(0.7300 0.1600 25);
  --danger-foreground: oklch(0.1800 0.0400 25);
  --cat-blue: oklch(0.6080 0.1400 255);
  --cat-teal: oklch(0.5960 0.1000 205);
  --cat-violet: oklch(0.6220 0.1600 293);
  --cat-pink: oklch(0.6260 0.1500 354);
  --cat-orange: oklch(0.6180 0.1400 55);
  --cat-indigo: oklch(0.6160 0.1500 275);
  --cat-green: oklch(0.5920 0.1300 150);
  --cat-red: oklch(0.6260 0.1600 25);
  --cat-slate: oklch(0.6060 0.0300 260);
  --cat-yellow: oklch(0.6080 0.1400 85);
  --cat-foreground: oklch(0.2100 0 0);
}
```

## Appendix B: tokens as HSL channel triplets

For Tailwind 3 apps whose config reads `hsl(var(--x))` or `hsl(var(--x) / <alpha-value>)`. This is the sRGB conversion of Appendix A; the colours that sit outside sRGB were brought in by lowering chroma, which keeps their lightness and hue. Add `--radius: 0.5rem;` alongside.

```css
:root {
  --background: 210.0 16.6% 97.6%;
  --foreground: 252.0 9.1% 10.8%;
  --card: 0.0 0.0% 100.0%;
  --card-foreground: 252.0 9.1% 10.8%;
  --popover: 0.0 0.0% 100.0%;
  --popover-foreground: 252.0 9.1% 10.8%;
  --primary: 259.8 71.0% 57.7%;
  --primary-foreground: 0.0 0.0% 100.0%;
  --secondary: 220.0 14.4% 95.9%;
  --secondary-foreground: 215.0 27.9% 16.9%;
  --muted: 220.0 14.4% 95.9%;
  --muted-foreground: 220.0 9.2% 44.8%;
  --accent: 250.0 100.0% 97.6%;
  --accent-foreground: 262.1 83.3% 57.8%;
  --destructive: 356.9 71.6% 48.1%;
  --destructive-foreground: 0.0 0.0% 100.0%;
  --border: 220.0 13.0% 91.0%;
  --input: 220.0 5.1% 56.7%;
  --ring: 258.1 66.1% 61.4%;
  --chart-1: 258.3 89.5% 66.3%;
  --chart-2: 330.4 81.2% 60.4%;
  --chart-3: 292.2 84.1% 60.6%;
  --chart-4: 238.7 83.6% 66.7%;
  --chart-5: 349.7 89.2% 60.2%;
  --sidebar: 253.6 21.5% 20.0%;
  --sidebar-foreground: 210.0 16.6% 97.6%;
  --sidebar-primary: 259.8 71.0% 57.7%;
  --sidebar-primary-foreground: 0.0 0.0% 100.0%;
  --sidebar-accent: 254.1 20.0% 33.3%;
  --sidebar-accent-foreground: 0.0 0.0% 100.0%;
  --sidebar-border: 254.1 20.0% 33.3%;
  --sidebar-muted-foreground: 240.5 12.7% 67.7%;
  --sidebar-ring: 255.1 91.8% 76.3%;
  --suite-nav-header: 254.1 26.2% 12.7%;
  --suite-nav-panel: 252.9 21.2% 25.9%;
  --suite-nav-hover: 254.1 20.0% 33.3%;
  --success: 146.2 100.0% 23.7%;
  --success-foreground: 0.0 0.0% 100.0%;
  --warning: 44.5 100.0% 25.8%;
  --warning-foreground: 0.0 0.0% 100.0%;
  --info: 202.3 100.0% 33.6%;
  --info-foreground: 0.0 0.0% 100.0%;
  --danger: 355.5 76.7% 43.4%;
  --danger-foreground: 0.0 0.0% 100.0%;
  --cat-blue: 211.3 78.8% 46.5%;
  --cat-teal: 184.6 100.0% 26.2%;
  --cat-violet: 258.7 75.2% 61.9%;
  --cat-pink: 328.4 64.5% 49.7%;
  --cat-orange: 30.4 100.0% 35.3%;
  --cat-indigo: 235.4 71.6% 62.4%;
  --cat-green: 142.1 70.1% 30.5%;
  --cat-red: 357.4 71.0% 51.4%;
  --cat-slate: 217.1 11.8% 46.5%;
  --cat-yellow: 44.7 100.0% 28.6%;
  --cat-foreground: 0.0 0.0% 98.7%;
}

.dark {
  --background: 222.2 47.3% 11.2%;
  --foreground: 210.0 40.0% 98.0%;
  --card: 217.2 32.5% 17.4%;
  --card-foreground: 210.0 40.0% 98.0%;
  --popover: 217.2 32.5% 17.4%;
  --popover-foreground: 210.0 40.0% 98.0%;
  --primary: 253.9 100.0% 81.2%;
  --primary-foreground: 222.2 47.3% 11.2%;
  --secondary: 215.3 25.0% 26.7%;
  --secondary-foreground: 210.0 40.0% 98.0%;
  --muted: 217.2 32.5% 17.4%;
  --muted-foreground: 215.0 20.2% 65.1%;
  --accent: 263.5 67.4% 34.9%;
  --accent-foreground: 210.0 40.0% 98.0%;
  --destructive: 0.0 70.0% 35.3%;
  --destructive-foreground: 210.0 40.0% 98.0%;
  --border: 215.3 21.6% 31.8%;
  --input: 215.3 15.8% 46.7%;
  --ring: 255.1 91.8% 76.3%;
  --chart-1: 255.1 91.8% 76.3%;
  --chart-2: 328.6 85.5% 70.2%;
  --chart-3: 292.0 91.4% 72.5%;
  --chart-4: 234.5 89.5% 73.9%;
  --chart-5: 351.3 94.5% 71.4%;
  --sidebar: 228.6 84.0% 4.9%;
  --sidebar-foreground: 210.0 40.0% 98.0%;
  --sidebar-primary: 255.1 91.8% 76.3%;
  --sidebar-primary-foreground: 222.2 47.3% 11.2%;
  --sidebar-accent: 217.2 32.5% 17.4%;
  --sidebar-accent-foreground: 0.0 0.0% 100.0%;
  --sidebar-border: 215.3 25.0% 26.7%;
  --sidebar-muted-foreground: 240.5 12.7% 67.7%;
  --sidebar-ring: 255.1 91.8% 76.3%;
  --suite-nav-header: 227.1 87.5% 3.1%;
  --suite-nav-panel: 221.5 39.4% 12.9%;
  --suite-nav-hover: 221.1 31.1% 23.9%;
  --success: 135.3 43.6% 56.2%;
  --success-foreground: 133.1 48.9% 5.6%;
  --warning: 42.3 72.9% 55.5%;
  --warning-foreground: 41.0 84.7% 7.4%;
  --info: 206.7 90.7% 66.6%;
  --info-foreground: 208.1 89.3% 7.0%;
  --danger: 3.1 96.1% 72.0%;
  --danger-foreground: 2.9 58.9% 8.0%;
  --cat-blue: 213.1 63.0% 54.6%;
  --cat-teal: 184.8 86.5% 32.7%;
  --cat-violet: 255.4 61.6% 65.3%;
  --cat-pink: 332.9 51.3% 57.8%;
  --cat-orange: 27.5 72.1% 44.7%;
  --cat-indigo: 232.5 63.0% 64.7%;
  --cat-green: 137.2 44.6% 39.8%;
  --cat-red: 2.2 62.3% 58.8%;
  --cat-slate: 217.1 11.9% 52.6%;
  --cat-yellow: 44.9 100.0% 32.3%;
  --cat-foreground: 0.0 0.0% 9.5%;
}
```
