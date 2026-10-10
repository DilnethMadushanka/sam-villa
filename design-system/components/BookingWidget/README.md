# BookingWidget

Where a guest picks dates and guests and sees the price. It comes in two shapes from the same parts.

- **Bar** (home page): check-in, check-out, guests and "Check availability" in one row on desktop, sitting just under the hero. Two-up below `bp-lg`, stacked below 480px.
- **Panel** (room page): rate and availability on top, the fields, every line item, the total, then the CTA. Sticky beside room details from `bp-md`.
- **Provide:** dates, guests, nightly rate, line items, total, cancellation line.
- Labels sit above inputs in `label` style; inputs are pills with a `line-strong` border. Never use a placeholder as a label.
- Errors appear under the field in `error` with an icon and a sentence that says how to fix it ("Check-out must be after check-in.").
- Show every fee before the total. Use "Request to book" on the final step if the hosts confirm each booking.
