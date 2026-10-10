# RoomCard

A room's summary in the rooms section. Rooms are laid out as one featured card beside a stack of compact cards, never as a row of identical cards.

- **Provide:** a photo, room name, availability, two or three facts as icon and label pairs (bed, sleeps, view), the nightly rate, and a "View room" link.
- `sv-room--featured`: the room to lead with, tall photo with `radius-arch` top corners. `sv-room--compact`: photo beside text.
- Facts use Phosphor icons in `jungle`, not dot-separated strings.
- Prices use `price` with tabular numbers. Rates shown in previews are samples.
- The card lifts 4px with `shadow-2` on hover. On phones every card stacks to one column.
