# Architecture

The design system is built in five layers. Each layer may only use the layers below it.

| Layer | What it holds | Examples |
| --- | --- | --- |
| 1. Tokens | Raw decisions as named values | `jungle`, `space-6`, `radius-arch`, `shadow-3`, `heading-m` |
| 2. Base | Resets, element defaults, type classes, focus ring | `body`, `h1`–`h4`, `a`, `.sv-root :focus-visible` |
| 3. Components | Single-purpose UI pieces | Button, AvailabilityPill, RoomCard, BookingWidget, Gallery |
| 4. Sections | Page bands composed of components | Hero, AmenityBento, PhotoBand, Reviews, LocationBlock, ClosingCTA, SiteFooter |
| 5. Templates | Page layouts made of sections | Home, Rooms, Room detail, Booking, Around us, Contact |

## Token tiers

- **Primitive** values live only in `tokens.json` (the hex, px and font values).
- **Semantic** tokens are what components use: `ground`, `ink`, `jungle`, `on-jungle`, `line-strong`, `focus`. Components never use a raw hex or px value.
- **Component** values are set inside the component's CSS from semantic tokens (for example the booking widget's padding is `space-6`). Add a component token only when a value is reused in three or more places.
- The site has one light theme. If a dark theme is added later, it swaps semantic values only; components need no theme code.

## Naming conventions

- **Tokens:** kebab-case, `role-variant`: `ground-raised`, `ink-muted`, `on-jungle`, `space-6`, `radius-md`, `shadow-2`, `bp-md`. Colour names describe the role (`ground`, `ink`, `line`) or a named brand hue (`jungle`, `marigold`, `laterite`), never a lightness (`green-700`) in component code.
- **CSS classes:** BEM with a `sv-` prefix: block `sv-room-card`, element `sv-room-card__price`, modifier `sv-button--primary`. State uses `is-` classes or ARIA attributes (`aria-current="page"`, `aria-expanded`, `[disabled]`).
- **Components:** PascalCase in code and docs (`RoomCard`, `BookingWidget`), kebab-case for files (`room-card.css`).
- **Content and data:** rooms use a stable slug (`garden-suite`); image files use `room-slug_shot_width.jpg` (`garden-suite_bed_1600.jpg`).
- **Breakpoints:** mobile first, `min-width` queries at `bp-sm` 640px, `bp-md` 768px, `bp-lg` 1024px, `bp-xl` 1280px.

## File structure for the website

```text
sam-villa/
├─ design-tokens/
│  ├─ tokens.json            # source of truth (this system)
│  └─ tokens.css             # generated custom properties
├─ src/
│  ├─ styles/
│  │  ├─ base.css            # reset, element defaults, focus ring
│  │  └─ utilities.css       # .sv-muted, .sv-num, layout helpers
│  ├─ components/
│  │  ├─ button/             # button.css, Button.(astro|jsx), README.md
│  │  ├─ availability-pill/
│  │  ├─ room-card/
│  │  ├─ booking-widget/     # includes date-picker/ and guest-select/
│  │  ├─ gallery/            # includes lightbox/
│  │  ├─ amenity-bento/
│  │  ├─ photo-band/
│  │  ├─ reviews/
│  │  ├─ location-block/
│  │  ├─ closing-cta/
│  │  ├─ site-header/
│  │  └─ site-footer/
│  ├─ sections/              # page bands that compose components
│  ├─ templates/             # home, rooms, room-detail, booking, around-us, contact
│  ├─ content/
│  │  ├─ rooms/              # garden-suite.md (name, rate, facts, amenities, photos)
│  │  ├─ reviews.json
│  │  └─ site.json           # address, phone, check-in times, policies
│  └─ pages/                 # routes that pick a template and content
└─ public/
   ├─ images/rooms/          # garden-suite_bed_1600.jpg …
   └─ logo/
```

- Content (rooms, prices, reviews, policies) lives in `content/`, separate from layout, so the host can update a rate or add a room without touching components.
- Each component folder owns its CSS, markup and README. Sections import components; templates import sections; pages import templates.
- The structure works with any static site tool (Astro, Eleventy, Next.js). Pick one when the build starts.

## Component inventory

| Component | Layer | Status |
| --- | --- | --- |
| Button | Component | Preview + guidelines |
| AvailabilityPill | Component | Preview + guidelines |
| BookingWidget | Component | Preview + guidelines (bar and panel) |
| RoomCard | Component | Preview + guidelines |
| Gallery | Component | Preview + guidelines (lightbox to design) |
| Hero | Section | Preview + guidelines |
| AmenityBento | Section | Preview + guidelines |
| PhotoBand | Section | Preview + guidelines |
| Reviews | Section | Preview + guidelines |
| LocationBlock | Section | Preview + guidelines |
| ClosingCTA | Section | Preview + guidelines |
| SiteHeader | Section | Preview + guidelines, with mobile menu sheet |
| SiteFooter | Section | Preview + guidelines |
| DatePicker | Component | To design, opens from BookingWidget |
| GuestSelect | Component | To design (adults, children, infants) |
| FAQ accordion | Component | To design |
| Contact form | Component | To design |

## Stack

- Default: Astro or Next.js with this stylesheet and tokens as CSS custom properties. Tailwind v4 also works if the tokens are mapped into its theme.
- Icons: Phosphor only. Motion: CSS transitions and scroll-driven animations; add the Motion library only if a component truly needs it.
