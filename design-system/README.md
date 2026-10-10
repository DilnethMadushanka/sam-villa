Sam Villa is a small bed and breakfast with four garden rooms. The site should feel like arriving at a friend's garden house: bright, welcoming and clear about what a stay costs. The design follows the taste-skill rules (see the Taste rules section), read as a hospitality landing page for travellers, with dials DESIGN_VARIANCE 6, MOTION_INTENSITY 4, VISUAL_DENSITY 3.

## Voice

- Write as the hosts: "we" and "you", short plain sentences. "Breakfast is on the veranda from 7:30."
- Sentence case everywhere. Uppercase only in form labels and at most one eyebrow per three sections.
- Lead with what guests decide on: price per night, who a room sleeps, check-in time, cancellation terms.
- No emoji, no em-dashes, no filler verbs ("elevate", "unwind in luxury"). Use real numbers or mark them as samples.

## Colour

- One palette, one accent. Pages sit on `ground`; cards and the booking panel on `ground-raised`; tinted bands on `ground-sunk` or `jungle-soft`.
- `jungle` (deep garden green) is the brand colour: the mark, links, secondary buttons, icons. Text on it is `on-jungle`.
- `coral` (hibiscus) is the single accent and is reserved for the booking CTA, rating stars and the active nav marker. Its label is `on-coral`. As text, use `coral-ink`.
- `error` is for problems only and always comes with an icon and words.
- Text is `ink`, secondary text `ink-muted`; both pass 4.5:1 on every ground.
- Every interactive element shows a 2px solid `focus` ring with a 2px offset.
- The site uses one light theme everywhere, by the owner's choice. No section flips to a dark band; only photos carry a scrim.

## Type

- Headings use `display` (Bricolage Grotesque, a warm grotesque with soft curves); text and UI use `sans` (Figtree). Production builds self-host both with `font-display: swap`.
- One `display-xl` per page, in the hero, max 2 lines. Sections use `heading-m`, max 8 words; room names `heading-s`.
- Body copy is `body`; intros `body-l`, max 25 words. Keep running text within `text-measure`.
- Prices use `price` with tabular numbers.

## Shape and space

- Shape rule: everything you press (buttons, inputs, chips, pills) uses `radius-pill`; everything you look at (cards, photos, tiles) uses `radius-lg`. The hero, featured-room and gallery lead photos get the villa arch with `radius-arch` on their top corners only.
- Spacing is a 4px scale. Sections are `space-24` apart on desktop and `space-16` on phones. Cards pad `space-6`.
- Content sits in a `content-max` container with a `space-6` gutter (`space-4` on phones). Every multi-column layout collapses to one column below `bp-md`.

## Elevation

- `shadow-1` for cards at rest, `shadow-2` for hover and the scrolled header, `shadow-3` for the booking panel, menus and dialogs. Shadows are tinted green, never pure black on Day.

## Motion

- The hero copy enters once on load with a short stagger. Sections rise into place as they scroll in (CSS scroll-driven animation). Cards lift on hover and buttons press to 0.98.
- Animate only transform and opacity. Everything is static under `prefers-reduced-motion`.

## Imagery

- Photography sells the stay: real rooms, breakfast, the garden, the hosts, in natural light. No stock photos of people who never stayed.
- Until photos exist, components show labelled photo slots that name the shot and size needed.

## Iconography

- Phosphor icons, regular weight, one family only, drawn in `jungle` (stars use the fill weight in `coral`). Never draw icons by hand.

## Components

Navigation: SiteHeader, SiteFooter. Actions: Button. Booking: BookingWidget, AvailabilityPill. Rooms: RoomCard, Gallery. Sections: Hero, AmenityBento, PhotoBand, Reviews, LocationBlock, ClosingCTA. The shared stylesheet is `components/bundle.css`; every class uses the `sv-` prefix (see Architecture).
