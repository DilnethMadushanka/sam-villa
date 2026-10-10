# SiteHeader

The sticky top bar: the Sam Villa mark, five section links on one line, and the booking CTA.

- **Provide:** the current section (`aria-current="page"` shows a coral underline) and at most five links.
- Height is `header-height` (72px, 64px on phones), never above 80px. Sticks at `top: env(safe-area-inset-top, 0px)`.
- Below `bp-lg` the links and CTA fold into a "Menu" button that opens a full-screen sheet (`shadow-3`) with the same links and the booking CTA; Escape closes it.
- The SV monogram is a placeholder mark. Replace it with the real logo at the same height.
