# Button

Buttons start or commit a guest action. Every button is a pill.

- **Provide:** a label of 3 words or fewer that says what happens, and a variant class. Labels never wrap at desktop.
- `sv-button--primary` (`coral` fill, `on-coral` label): the booking action only, labelled "Check availability" everywhere on a page (header, hero, booking bar, closing CTA). One label per intent.
- `sv-button--secondary` (`jungle` outline): browsing actions such as "See the rooms", "View room", "Open in Maps".
- `sv-button--quiet`: toolbar actions such as "Menu" and "Close".
- Hover lifts 1px with `shadow-2`; press scales to 0.98. Disabled buttons keep their label ("Fully booked").
- Don't: use coral for anything except the booking action, or write "Click here" / "Submit".
