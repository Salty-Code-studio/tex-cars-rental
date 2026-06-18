# Operations Planning Board — Design Spec

**Date:** 2026-06-11 · **Status:** Approved, ready for plan

Turn the read-only admin planning board into the live control surface the front
desk runs the business from: create rentals, move them, and manage off-rental
states (maintenance, carwash) directly on the calendar.

## Decisions (locked with the owner)

1. **Manual rentals = quick.** Drag-select a date range on a car's row → "New
   rental" popover: customer **name + phone** (email/price/note optional), dates
   prefilled. Creates a **confirmed** booking, `source: manual`, no Stripe, no
   licence wall (captured at pickup). If no email, the customer links via a
   synthetic internal address.
2. **Off-rental states = fixed types.** Block a car with a type
   (`maintenance · carwash · cleaning · out_of_service · other`) + optional note.
   Each type is color-coded on the timeline.
3. **Drag to move = dates AND reassign car.** Drag a booking bar left/right to
   shift dates, or onto another car's row to reassign. Validated on drop.
4. **Plate is the row ID.** `vehicles.plate` (required, unique) shown bold, model
   small beneath.

## The firm rule

Admin actions may skip the **soft** guardrails (lead time, advance window,
min/max length) — the desk books same-day. They can **never** skip the
**physical** no-overlap-plus-buffer exclusion constraint. A manual booking or a
drag that would double-book (or violate the cleaning buffer) is rejected by the
database, exactly like an online booking.

## Data model (one migration, 0010)

- `vehicles.plate` text **unique not null** — backfill existing seed cars with
  placeholders the owner edits in Fleet.
- `availability_blocks.type` pgEnum `block_type` default `other`.
- `bookings.source` pgEnum `booking_source` (`online` | `manual`) default
  `online`; `bookings.notes` text nullable.

## Services + APIs (admin, requireAdmin + audit)

- `createManualBooking({ vehicleId, startDate, endDate, customerName,
  customerPhone, customerEmail?, priceCents?, notes? })` — upsert/find customer
  (synthetic email if none), validate end>start only (skip soft guardrails),
  insert booking `status: confirmed, source: manual, paymentOption: cash_deposit,
  bufferEndDate = end + buffer`; the exclusion constraint enforces no-overlap
  (23P01 → 409).
- `moveBooking(id, { vehicleId?, startDate?, endDate? })` — one transaction
  updates vehicle and/or dates + recomputes bufferEndDate; 23P01 → 409. Only
  pending|confirmed bookings move.
- `cancelBookingAdmin(id)` — admin cancels any booking (frees the slot).
- Blocks: extend the existing `POST /api/admin/vehicles/[id]/blocks` to accept
  `type`; `DELETE /api/admin/blocks/[id]` already exists. Add `PATCH` for move.
- Routes: `POST /api/admin/bookings`, `PATCH /api/admin/bookings/[id]/move`,
  `POST /api/admin/bookings/[id]/cancel`.

## UI (the planning board)

- Row label: plate bold + model small; pinned left; vertical scroll for ~30 cars
  with the day header + category bands sticky.
- **Drag-select** an empty range on a row → action menu: New rental | Block car.
- **Drag a bar**: horizontal = move dates (snap to day columns); vertical onto
  another row = reassign. Optimistic update; revert + message on 409.
- **Click a bar** → details popover: customer/dates/status, with Move (form),
  Cancel, and for blocks Edit/Remove.
- Block bars color-coded by type; bookings keep status colors.
- All built with pointer events (no drag library); pure CSS positioning as today.

## Testing

- Services unit-tested against PGlite: manual booking creation (incl. overlap
  rejection via the constraint, synthetic-email customer, same-day allowed),
  move (date shift, reassign, overlap/buffer rejection, only pending/confirmed),
  admin cancel, block-with-type, plate uniqueness.
- Board interactions verified live in the browser (create, drag-move, reassign,
  block, cancel).

## Out of scope (already in the hub)

Pricing, settings, add-ons, insurance, policies stay on their existing pages.
This plan is only the interactive calendar.

## The 30 cars

Fleet page gains the plate field. The owner adds their 30 cars there; or pastes
the plate+model list and we bulk-seed so the board is real on day one.
