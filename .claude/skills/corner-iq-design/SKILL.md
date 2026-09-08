---
name: corner-iq-design
description: Reference for Corner IQ's UI design system (colors, type scale, shared components, Danish copy) — the "papir, ikke skærm" warm-white/clay-orange look modeled loosely on Supabase. Use this whenever building or editing ANY page, card, panel, button, badge, or other UI in this repo, even for a small tweak, so new work reuses existing tokens and src/components/ui.tsx primitives instead of inventing new colors, radii, or shadows. Also consult it whenever a color, border, or background looks wrong or "washed out" on screen — check the bg-(--color-x) vs bg-[--color-x] syntax first, since the wrong one silently renders as transparent with no error.
---

# Corner IQ design system

Corner IQ's own description of itself (`src/app/globals.css`): **"Papir, ikke
skærm"** — paper, not screen. Warm off-white, hairline dividers instead of
boxed cards, burnt orange as the only accent, used sparingly. Typography
carries the hierarchy; color just confirms it. All UI copy is Danish.

## The one bug to check before anything else

`bg-[--color-x]` (square brackets) compiles to **nothing** in this Tailwind
v4 setup — no error, no crash, it just silently falls back to
transparent/currentColor. The correct syntax references the CSS custom
property with **parentheses**:

```
bg-(--color-clay)      ✅
bg-[--color-clay]       ❌ silently renders as transparent
```

This single typo previously caused 194 near-invisible color bugs across 29
files (selected menu items, buttons, borders all "disappearing" while
looking almost-fine in a screenshot). Any time a color/border/background
looks off, grep for square-bracket custom-property references before
looking anywhere else.

## Tokens (`src/app/globals.css`, inside `@theme`)

| Token | Value | Use |
|---|---|---|
| `--color-surface` | `#ffffff` | the page itself |
| `--color-raised` | `#faf7f3` | faintly tinted panel/section background |
| `--color-sunken` | `#f4efe9` | hover/active background on a raised surface |
| `--color-line` | `#e4dbd0` | the visible hairline border |
| `--color-line-soft` | `#f0e9e1` | the near-invisible one (card outlines) |
| `--color-text` | `#241c17` | warm dark brown — never pure black |
| `--color-muted` | `#6b5a4c` | secondary text |
| `--color-faint` | `#96826e` | tertiary text, hints, counts |
| `--color-clay` | `#e35f1e` | **the** accent — saturated orange |
| `--color-clay-soft` | `#f0894a` | lighter clay, rarely needed directly |
| `--color-clay-wash` | `#fdf0e6` | clay's light fill (buttons, badges) |
| `--color-clay-line` | `#f6c9a4` | clay's border/hover-fill tone |
| `--color-ok` / `--color-warn` / `--color-alert` | `#4f7c52` / `#b8801f` / `#b3462f` | status colors |
| `--color-ink` | `#14100c` | true black — reserved, see below |

`--color-ink` is defined for "the one primary send/confirm action per
screen" per the CSS comment, but no component currently uses it (checked
via grep) — everything, including primary actions, currently uses the
light-clay `ClayButton` style below. Don't reach for `--color-ink` for a
new button; match what's actually there (clay) unless explicitly asked for
a heavier, once-per-screen "just do it" action.

Fonts: `--font-sans` (Inter, UI default), `--font-serif` (Cambria — long-form
article pages only, see exception below), `--font-mono` (eyebrow labels,
tabular numbers).

## Shared primitives — use these, don't reinvent them

`src/components/ui.tsx` exports the actual building blocks. Reach for these
before writing a new `<button>` or `<div className="rounded...">`:

- **`ClayButton`** — the primary action. Light orange fill + thin
  clay-line border + clay text (`bg-(--color-clay-wash) border-(--color-clay-line) text-(--color-clay)`),
  hover darkens to `bg-(--color-clay-line)`. Never a solid saturated-orange
  or solid-black button.
- **`OutlineButton`** — secondary action. White fill, hairline
  `--color-line` border, muted text that darkens on hover. The
  "Docs/Examples"-style secondary button.
- **`Panel`** — the standard card: `rounded-lg border border-(--color-line-soft) bg-(--color-surface) p-5`
  with a very soft shadow, optional title + right-aligned action in the header.
- **`Card`** — lighter grouping with no border, just `rounded-lg bg-(--color-raised)`.
- **`SectionTitle`** — a title with a `border-b border-(--color-line)` divider under it (a bare heading, no card).
- **`Badge`** — pill badge, tone-based (`clay`/`ok`/`warn`/`alert`/`muted`/`faint` — see `Tone` type).
- **`Stat`** — a KPI number: `border-l border-(--color-line)` on the left, `.eyebrow` label above, mono tabular number below.
- **`Empty`** — centered muted placeholder text for empty states.

A second card idiom exists alongside `Panel`/`Card`: a **left-accent-line
list row** — `border-l-2 border-(--color-line) pl-4` that turns
`border-(--color-clay)` on hover (see `SystemCard.tsx`). Use this for dense
list items (systems, roles, data objects); use `Panel` for a standalone
section/card.

## Type scale

Not default Tailwind sizes — this codebase uses a deliberate arbitrary
scale via `text-[Npx]`, consistently across components:

- `text-[11px]` / `text-[11.5px]` — hints, counts, badges, meta text
- `text-[12px]` / `text-[12.5px]` — body copy inside cards, buttons
- `text-[13px]` — `ClayButton` label size
- `text-[14px]` / `text-[14.5px]` — card titles, row names
- `text-[15px]` / `text-[16px]` — section/panel headers (`font-semibold tracking-tight`)
- `44px` mono `.hero-number` — the one genuinely large number on a page

Match the nearest existing size instead of picking a fresh px value or a
default Tailwind step (`text-sm`, `text-lg`, etc.) — the whole app reads as
one system because these repeat everywhere.

The `.eyebrow` class (mono, `0.6875rem`, `0.08em` tracking, uppercase,
`--color-faint`) is the small-caps section label — use it via `className="eyebrow"`, don't hand-roll `uppercase tracking-wide text-xs` again.

## Radius, borders, shadow

- Cards/panels/buttons: `rounded-md` or `rounded-lg` — never `rounded-xl`/`rounded-2xl`, never square.
- Borders are hairline and warm-toned (`--color-line` / `--color-line-soft`), not gray (`border-gray-200` etc.) and not heavy (`border-2`, except the deliberate `border-l-2` list-row accent above).
- Shadows are barely-there and warm: `shadow-[0_1px_2px_rgba(20,16,12,0.03)]` on `Panel`, or the `.lift`/`.lift-hover` utility classes (`rgba(60,40,24,...)`, not a gray/black shadow) for the process-model's diagram tiles specifically. Don't add a default Tailwind `shadow-md`/`shadow-lg` — it reads as gray and breaks the palette.

## Deliberate exception: the business-case article page

`/improvements/[id]` (the AIOS proposal report) is intentionally **not**
card-based: a long-form blog-article layout with a cover gradient, a serif
heading (`--font-serif`), and prose sections. This was an explicit design
call, not an inconsistency to "fix" — don't refactor it toward the
card/panel style used everywhere else, and don't use its style as a
template for a new page unless it's genuinely another long-form report.

## Language

All UI copy — labels, buttons, empty states, error messages — is Danish.
Match the existing tone: direct, lowercase-first sentence case (not Title
Case), short (see `Empty`/`Badge` usage across the app for examples).
