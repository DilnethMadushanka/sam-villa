# Sam Villa

Website for Sam Villa, a small garden bed and breakfast.

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The home page. Open it in a browser, no build step needed. |
| `css/tokens.css` | Design tokens as CSS custom properties (colors, type, spacing, radius, shadows). |
| `css/components.css` | Shared component styles, every class prefixed `sv-`. |
| `css/page.css` | Home page layout. |
| `js/main.js` | Mobile menu, booking bar night count, copy buttons. |
| `design-system/` | The design system: `tokens.json`, brand book (`README.md`), architecture, page templates, taste rules, and each component's guidelines and preview. |

## Before launch

- Replace every labelled photo slot with real photography (each slot names the shot and size).
- Replace sample rates, review score, reviews, travel times and contact details.
- Swap the SV monogram for the real logo.
- Self-host the two fonts (Bricolage Grotesque, Figtree) with `font-display: swap`.
- Connect the booking bar to a real booking or enquiry service.

Component previews in `design-system/components/*/preview.html` expect `css/tokens.css` and `components/bundle.css` to be loaded first; they render live in the published design system page.
