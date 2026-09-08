# Tex Cars: WhatsApp request quiz at tex-cars.com/book

Specification, version 2. Written for Mo. Every line number in here was read off the files on disk on 2026-09-08 and re-checked against the code for this revision.

A note on style: this document contains no em dash and no double hyphen anywhere, because the house writing rule forbids both. That includes command flags, so flags are written out in words and the literal commands in section 14 are spelled out unambiguously.

***

## 1. What this is, and what the owner loses

Today a customer on tex-cars.com is pushed to `app.tex-cars.com/book`, the full online booking wizard. It reserves a car, it holds a vehicle, it confirms instantly.

After this change, a customer on tex-cars.com goes to `tex-cars.com/book`, a four step quiz on the marketing site. The quiz never reserves anything. It saves a request into the back office and it opens WhatsApp with the request already typed out, so Tex can answer a real person.

**Read this part twice. This is what stops working.**

1. **The online booking wizard stops taking customer bookings.** `app.tex-cars.com/book` gets redirected to the quiz. The wizard code stays on disk and the redirect is three lines, so it can be undone, but from the day this ships no customer can self serve a confirmed booking.
2. **No instant confirmation.** The customer gets "Tex will answer you on WhatsApp", nothing more. There is no confirmation email, no booking number, no PDF.
3. **No car is held.** Two people can request the same Hyundai i10 for the same week and both will be told nothing is reserved. Whoever Tex confirms first gets it. This is guardrail G2 and it is deliberate.
4. **Every request needs a human reply.** There is no automation on the other end. If Tex does not open WhatsApp, the customer hears nothing. The request row in the back office does not chase anybody.
5. **The homepage inquiry form is retired.** The block that collected name, email, dates and a message is replaced by a short call to action pointing at the quiz. Nobody can send an unstructured inquiry from the homepage any more.
6. **No pick-up time step, and no "anything we should know" step.** The customer cannot say "I land at 11 and want it at noon" anywhere except the one free text line on the delivery step. That line is the only free text in the whole quiz.
7. **Reporting gets thinner, not richer.** Requests are hard deleted after 90 days (section 9), so the conversion count in the back office only ever covers the last 90 days. There is no all time funnel number.

What is gained: a customer who does not have a credit card, does not want to fill in a licence, and is standing in an airport queue on a phone can send a complete, structured request in about twenty seconds, and Tex gets it as a WhatsApp message with the dates and the car already written out.

Nothing in this document is built, deployed, tested or verified. It is a plan. Section 13 lists what has to be true before it may go live.

***

## 2. The locked decisions and the guardrails

These came from the owner. They are not reopened anywhere in this document.

| Ref | Decision |
| - | - |
| D1 | Customer booking moves to a quiz at tex-cars.com/book. The app stays live as back office only. Its public `/book` wizard is fenced off. |
| D2 | Four steps: car, dates on a two month tap to pick calendar, delivery preference phrased as a request and not a promise, then name and WhatsApp number. |
| D3 | A price estimate is shown, computed from the real rates in `site/data/fleet.js`, always labelled an estimate to confirm, never a quote. The deposit is a footnote, not part of the estimate. |
| D4 | The quiz saves the request to the app, so the back office gets a list, a conversion count and a prefill action. |
| D5 | The quiz collects a WhatsApp phone number. Phone is required. |
| D6 | The quiz lives on its own page at `/book`. The homepage inquiry form retires in favour of a short call to action block. |
| D7 | No pick-up time step and no separate "anything we should know" step. The delivery free text line is the only free text. |

| Ref | Guardrail |
| - | - |
| G1 | No silent write. A visible "Send request" button, an awaited POST, a visible state. WhatsApp opens in every case, including save failure, timeout, 4xx, 5xx and offline. |
| G2 | A request never touches the `bookings` table and never reserves a vehicle. |
| G3 | No Telegram alert per request. That bot is load bearing for desk approvals. The in app surface is used instead. |
| G4 | The privacy policy is published before any personal data is stored. Minimise the data, cap the retention hard, keep a deletion path that actually works. |
| G5 | Abuse controls are launch blockers, not follow ups. |

***

## 3. Conflict resolutions, decided once

The five earlier design documents disagreed with each other. Each row below is now the only answer. Where an earlier document said something different, that document is superseded.

### C1. One table

**Decision: one table named `booking_requests`.** Shape is in section 7. It takes the intake route design as the base (its retention and cron wiring match the code that is actually on disk), grafts on a conditional upsert for idempotency, adds a required `phone` column for D5, and drops three things the earlier drafts carried.

Dropped and why:

- `ref`. See C5.
- `retain_until` and `purged_at`. Retention is a single hard delete on `created_at` (see C4), so a stored per row timer would only give the sweep a second source of truth to drift from.
- A client supplied `idempotency_key`. That column, as drafted, was a tampering primitive: unique plus upsert with no ownership proof means anyone who guesses a key rewrites a stranger's open request, and the desk only sees a counter tick. The replacement is a **server computed** `dedup_key`, a SHA-256 of the normalised phone plus car plus dates plus delivery. The client cannot choose it, and to collide with a stranger you would have to already know their phone number and their exact dates, at which point the row tells you nothing you did not have.

The conditional part is `setWhere: status = 'new'`. A converted or dismissed request is never silently overwritten by a resubmission. Drizzle 0.45.2 supports `setWhere` (`node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts:66`), so this is buildable today. When `setWhere` excludes the row, the statement is a clean no-op and `.returning()` comes back empty. The route ignores the return value entirely and always answers `{ ok: true }`, so that empty array can never throw on the path the customer is waiting on.

A customer who resubmits with different dates creates a second row rather than updating the first, because the dates are part of the key. That is intended: those are two different requests and the desk should see both.

### C2. One endpoint path

**Decision: `POST /api/booking-requests`** on `app.tex-cars.com`. Used in the quiz, in the route file, in the smoke test and in the Cloudflare rate limiting rule. `/api/requests` and `/api/public/rental-requests` are dead names and appear nowhere.

### C3. One delivery enum

**Decision: `["airport", "hotel", "pickup"]`.** Not `desk`. The word "desk" already means something specific and load bearing in this codebase (desk mode, the Telegram approval flow), so reusing it for "the customer collects the car" would make every future code review ambiguous. Two of the three earlier drafts already used `pickup`.

### C4. One retention rule

**Decision: a hardcoded constant, `REQUEST_RETENTION_DAYS = 90`, and a single sweep that hard deletes any row whose `created_at` is older than 90 days.** No settings column.

One sentence of justification, as asked: the number is printed in the published privacy policy and again in the consent line under the send button, and an owner editable setting would let both of those become quietly false without anybody noticing.

No redact in place, no anonymise, no second anchor on `end_date`. One rule, one anchor, one verb. Deleting a converted request does not damage its booking: the `converted_booking_id` foreign key points from the request at the booking, not the other way, and the customer's details already live on `customers` and `bookings` once a booking exists.

### C5. No reference code

**Decision: drop the ref code entirely.** No `ref` column, no unique index, no collision retry loop.

The ref code only ever existed to join the inbox row to the WhatsApp chat. With D5 the phone number does that job, and it does it better: the WhatsApp chat *is* the phone number. Removing it also removes a retry loop from the exact code path a customer is standing there waiting on, which was the whole objection one design raised against the other. The intake response is `{ ok: true }` and nothing else.

One honest gap: a customer can type one number and message from another. The prefilled WhatsApp text carries the car, the dates and the name, so the desk can match on those. Section 10 makes matching by phone the primary path and matching by car plus dates the stated fallback.

### C6. Content type

**Decision: `Content-Type: application/json`, parsed with `parseJsonBody`.** The preflight is unavoidable and correct.

`text/plain` is impossible without hand rolling the parse: `src/lib/http/validate.ts:101` throws `Errors.badRequest("Content-Type must be application/json")`, and hand rolling would throw away `readBodyCapped` (`validate.ts:69`, backed by the mid stream loop in `readBodyCappedBytes` at `validate.ts:38`), which is the only byte cap in this codebase that actually holds.

Related and required: **`parseJsonBody` must take an optional `maxBytes`.** Today its signature is `(req, schema)` with no cap argument, and it re-enforces only its own module constant `MAX_BODY_BYTES = 1_000_000` (`validate.ts:16`, used at `:108` and `:110`). The header pre-check `assertContentLengthWithinCap` (`validate.ts:82`) returns early when `Content-Length` is absent (`validate.ts:84`), and its own docblock at `validate.ts:73-81` says in as many words that it is never the sole defence. So the "4 KB cap" the earlier draft claimed did not exist: a chunked POST with no `Content-Length` got 1 MB. Add a third parameter defaulting to `MAX_BODY_BYTES`. That default keeps all 36 existing non-test `parseJsonBody` call sites byte for byte unchanged, and the intake route passes `4096`.

### C7. WhatsApp handoff

**Decision: same tab, on a real anchor, with no `target` attribute. Timeout 4000 ms.**

No `target="_blank"`, anywhere on the quiz page. In the Instagram and Facebook in app webviews, which carry a large share of Aruba rental traffic, `_blank` has no tab to open into: it either spawns a nested webview that cannot follow wa.me's redirect to the `whatsapp://` scheme, or it is swallowed with no visible effect. A same tab navigation is followed and the operating system hands off to WhatsApp.

The mechanism is two taps. Tap 1 is the "Send request" button, which awaits the POST. Tap 2 is a real `<a href="https://wa.me/...?text=...">` with no target, which appears once tap 1 resolves in any way. Because tap 2 is a fresh user gesture on a real anchor, no popup blocker and no `await` timing rule can interfere with it. The anchor's `href` is written **before** the POST is fired, from state the browser already holds, so it is correct even if the POST never returns.

Timeout is 4000 ms, not 2500 and not 6000. The container sleeps after 45 minutes of idle (`worker/index.ts:87`), so the first request of the morning pays a cold start; 2500 ms would abandon that save most mornings. 6000 ms is longer than a person holds still on a phone. Either way the timeout is not a failure for the customer: the screen advances to tap 2 regardless.

### C8. The notifications table

**Decision: change nothing in the `notifications` table. Write no notification rows for requests.**

Three reasons, all from the code:

1. `notifications.bookingId` is a foreign key to `bookings` (`src/lib/db/schema/notifications.ts:19`), so a request row can never be its deep link target. A bell item for a request would be a dead end by construction.
2. The unread badge is an unfiltered `count(*) where read_at is null` (`src/lib/admin/notifications-feed.ts:9-10`) against a table whose only index is on `created_at` (`notifications.ts:22-24`), and every open admin tab reruns it every 30 seconds (`notification-bell.tsx:23`). One flood of requests turns the desk's bell into a repeating sequential scan on the same database the desk books on.
3. The bell is owner only (`src/app/admin/(shell)/layout.tsx:83`) and the notifications API passes no role options so it denies staff by default. Staff would never see the item anyway.

The in app surface for G3 is instead a new admin page at `/admin/requests`, with a count next to its link in the side nav. Honest limitation, stated here rather than buried: **this does not push.** If nobody opens the admin, nobody is told. That is acceptable precisely because the customer's own WhatsApp message is the push, and it lands on Tex's phone within seconds of the request being saved.

### C9. Cron

**Decision: bolt the retention sweep onto the existing `expire-holds` cron. No new cron route.**

`src/app/api/cron/expire-holds/route.ts` already runs every 15 minutes, is already bearer authenticated at `:26`, and already runs three chores at `:31-33`. Its schedule is already listed in `wrangler.jsonc:60` and already dispatched in the hardcoded map at `worker/index.ts:131-135`. A new cron would need edits to **both** of those, which two earlier designs forgot, and the result would have been a privacy policy promising a 90 day cap enforced by a route that never fires. Adding a fourth chore to `expire-holds` needs zero infrastructure edits, and `vercel.json` (which still declares the same three crons) needs no edit either, because we are not adding a cron.

### C10. Conversion is not atomic, and this document does not pretend otherwise

`createManualBooking` has **no transaction.** `src/lib/admin/manual-booking.ts:48-88` is a bare `db.insert(bookings)` inside a `try`/`catch`, and the customer upsert at `:65-68` is two more separate statements. There is no `tx` in scope anywhere in that file. Any claim that "the booking insert and the request claim commit together" is false.

**Decision: do not add a transaction.** That function is the single path every desk booking goes through, live, today. Restructuring it for an admin convenience is out of proportion to the benefit.

So the convert flow is honestly two steps: create the booking through the existing `POST /api/admin/bookings`, then, on success, a separate `PATCH /api/admin/booking-requests/:id` marks the request `converted` and stores `converted_booking_id`.

If step 2 fails, the booking exists and the request still reads `new`. The desk may try to convert again. That second attempt hits the database exclusion constraint on `bookings`, whose current form is

```
EXCLUDE USING gist (
  "vehicle_id" WITH =,
  tstzrange("start_at", "buffer_end_at", '[)') WITH &&
) WHERE (status IN ('pending', 'confirmed', 'picked_up'))
```

installed by `drizzle/0016_high_gladiator.sql:23-27` (it replaced the earlier `daterange` forms from `drizzle/0002_booking_overlap_guard.sql:7-11` and `drizzle/0007_booking_buffer.sql:15-19`), and documented at `src/lib/db/schema/bookings.ts:16-18`. That constraint returns a clean 409 rather than a duplicate booking. So the worst realistic outcome is a confusing error message and a request row that still says `new`, not a double booking. The admin page shows a warning banner on any request whose `converted_booking_id` is set but whose status is not `converted`, so the desk can see the gap and fix it by hand.

***

## 4. The customer journey, with the copy

Four steps then a send screen. All copy below is the literal string. Dutch is the second value. Only English and Dutch exist: `site/scripts/i18n.js:12` sets `SUPPORTED = ['en', 'nl']`, and Spanish and Papiamento are paused pending native review.

### Step 1, the car

Heading: "Which car?" / "Welke auto?"

Six cards, one per car in `site/data/fleet.js`, each showing the photo, the name, the class label and the per day rate. Tapping a card selects it and advances. If the visitor arrived from a fleet card on the homepage, the matching card is preselected from `?car=hyundai-i10`.

The six keys are exactly the `slug` values in `fleet.js:19-24`: `hyundai-i10`, `ford-figo`, `suzuki-baleno`, `hyundai-accent`, `chevrolet-aveo`, `kia-rio`. **These are not vehicle ids.** See section 7.

### Step 2, the dates

Heading: "When do you need it?" / "Wanneer heb je hem nodig?"
Helper: "Tap your pick-up day, then your return day." / "Tik je ophaaldag aan, daarna je terugbrengdag."

Two months side by side, with previous and next month arrows, capped at 12 months ahead.

Three fixes over the Little John original, all of them real bugs there:

1. **Aruba time, not device time.** The reference `little-john-scooters/site/js/quiz.js:92` builds `todayISO` from `new Date()` on the visitor's phone, and `:133` greys out anything before it. A traveller whose phone is still on Central European time sees Aruba's current day greyed out for six hours a day. The quiz computes today as `new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Aruba' }).format(new Date())`, which yields `YYYY-MM-DD` directly. Aruba has no daylight saving, so this is exact.
2. **44 px touch targets.** The reference day cell sets no minimum height at all: `.cal2-day` (`little-john-scooters/site/css/styles.css:441-445`) is 10 px of vertical padding around a 13.5 px glyph, inside `.cal2-grid` (`:439`), a seven column grid with 4 px gaps. On a 375 px viewport that lands under 44 px on both axes. The quiz sets `min-height: 44px` on its own `.cal2-day` and drops the grid gap to 2 px so seven columns still fit.
3. **A mis-tap is never silent.** The reference at `quiz.js:176` wipes both dates when you tap a day at or before the current start, with no message. The quiz does the same reset (it is the right behaviour) but announces it: "Start date moved to Sat 14 Mar. Now tap your return day." / "Startdatum verplaatst naar za 14 mrt. Tik nu je terugbrengdag aan."

Rules: the return day must be after the pick-up day. Maximum span 90 days, matching `settings.maxRentalDays` (`src/lib/db/schema/settings.ts:36`). Maximum 365 days ahead, matching `maxAdvanceDays` (`:37`). The same three rules are re-checked on the server, because the browser is not trusted.

### Step 3, the delivery preference

Heading: "Where would you like it?" / "Waar wil je hem hebben?"

Three options, stored as the enum from C3:

| Stored | English | Dutch |
| - | - | - |
| `airport` | "Bring it to the airport" | "Breng hem naar het vliegveld" |
| `hotel` | "Bring it to my hotel" | "Breng hem naar mijn hotel" |
| `pickup` | "I collect it at Tex" | "Ik haal hem op bij Tex" |

Directly under the three options, always visible, phrased as D2 requires:

> "This is a request, not a confirmed pick-up. Tex will tell you what works on WhatsApp."
> "Dit is een verzoek, geen bevestigde afspraak. Tex laat je op WhatsApp weten wat kan."

One free text line, the only free text in the quiz:

Label: "Anything about the drop-off? (optional)" / "Iets over de aflevering? (optioneel)"
Placeholder: "Hotel name, flight number, time of day" / "Hotelnaam, vluchtnummer, tijdstip"

Maximum 200 characters, single line, counter shown from 150 onward.

### Step 4, who to message

Heading: "Who should Tex message?" / "Wie mag Tex een bericht sturen?"

Two required fields.

Name: "Your name" / "Je naam". Two to sixty characters.

Phone: "WhatsApp number" / "WhatsApp nummer". Placeholder `+297 560 1234`. Input type `tel`, `inputmode="tel"`, `autocomplete="tel"`.
Helper: "With the country code, so Tex can reach you." / "Met landcode, zodat Tex je kan bereiken."

Phone is required, per D5. It is validated as an optional leading `+` followed by 8 to 17 digits after spaces, dashes, dots and brackets are stripped. It is stored in that normalised form. Nothing verifies that the number is real or that it is on WhatsApp, and this document does not claim it does.

***

## 5. The price estimate

### Which currency

The quiz uses the same rule as the homepage, `priceCfg()` in `site/scripts/main.js:11-15`: Papiamento shows Aruban florin (`priceDay`, `priceWeek`, `priceMonth`, deposit 500), every other language shows US dollars (`usdDay`, `usdWeek`, `usdMonth`, deposit 250). Both price lists sit on every car in `fleet.js`, which is why an implementer reading that file has no way to guess which one is meant.

**In practice that means US dollars today**, because `i18n.js:12` limits the site to English and Dutch, so `lang()` can never return `pap`. The quiz still implements the full rule and still re-renders the estimate on the `langchange` event (`i18n.js:40`), so that re-enabling Papiamento later does not silently leave florin customers looking at dollar prices.

### The maths

`d` is the number of nights between the pick-up day and the return day.

1. If `d` is 30 or more: `months = floor(d / 30)`, and the remainder `r = d - months * 30`. Cost is `months * monthRate` plus the week and day cost of `r`.
2. Week and day cost of `n`: `weeks = floor(n / 7)`, `rd = n - weeks * 7`, cost is `weeks * weekRate + rd * dayRate`.
3. Then never charge more than the next larger bucket. If the week and day cost exceeds `(weeks + 1) * weekRate`, use that instead. If the whole total exceeds `(months + 1) * monthRate`, use that instead.

Worked examples on the Hyundai i10, at 35 a day, 210 a week and 700 a month:

- 6 days: `6 * 35 = 210`, and the one week cap is also 210, so 210.
- 8 days: one week plus one day, `210 + 35 = 245`, under the two week cap of 420, so 245.
- 30 days: exactly one month, so 700.
- 34 days: one month plus four days, `700 + 140 = 840`, under the two month cap of 1400, so 840.

The estimate is advisory only. The value the customer saw is stored on the request as `estimate_cents` so the desk knows what number to expect in the conversation, and it is **never** used to price anything. Money in this system is computed server side and nowhere else, exactly as `src/lib/db/schema/bookings.ts:33` says of `priceBreakdown` ("server-computed snapshot, never client math").

### The exact words the customer reads

This is the literal sentence, shown on the send screen with the numbers filled in:

> **English:** "Estimate: $210 for 6 days. Tex confirms the final price on WhatsApp."
> **Dutch:** "Schatting: $210 voor 6 dagen. Tex bevestigt de definitieve prijs via WhatsApp."

Directly beneath it, in smaller type, the deposit footnote. Present, not omitted, and outside the estimate as D3 requires:

> **English:** "A refundable deposit of $250 is arranged when you pick the car up. It is not part of this estimate."
> **Dutch:** "Een borg van $250 regel je bij het ophalen. Die valt buiten deze schatting."

The word "estimate" leads the sentence in both languages. The word "quote", the word "total" and any currency figure standing on its own without that sentence around it do not appear on the page.

***

## 6. The send step, and the G1 case table

The send screen shows a recap: Car, From, Until, Estimate, Where, Note, Name, WhatsApp number. Then the consent line, then the send button.

### The consent line, verbatim

Shown above the send button, with "Privacy policy" as a link to `https://app.tex-cars.com/policies/privacy`:

> **English:** "Tap send and we save your name, your WhatsApp number and the choices above so Tex can answer you. Nothing is reserved yet. We delete it after 90 days. Privacy policy"
> **Dutch:** "Als je verstuurt bewaren we je naam, je WhatsApp nummer en de keuzes hierboven zodat Tex je kan antwoorden. Er is nog niets gereserveerd. Na 90 dagen verwijderen we het. Privacybeleid"

### The two taps

**Tap 1, "Send request" / "Verstuur aanvraag".** Before the fetch is fired, the WhatsApp anchor's `href` is already written from state the browser holds. The button then goes to a busy state, "Sending…" / "Versturen…", and the POST is awaited with a 4000 ms abort.

**Tap 2, "Open WhatsApp".** A real anchor, no `target`, same tab. It appears the moment tap 1 resolves in any way at all.

### Every case, and what happens

G1 says WhatsApp opens in every case. Here is every case.

| What happens | What the customer sees | Does WhatsApp open |
| - | - | - |
| 201, saved | "Sent. Now open WhatsApp so Tex sees it." | Yes |
| 201, honeypot silently discarded | Same as above, deliberately | Yes |
| 422, validation rejected | "We could not save it here, so send it on WhatsApp instead. Nothing is lost." | Yes |
| 429, rate limited | Same line | Yes |
| 400, body rejected | Same line | Yes |
| 5xx, server error | Same line | Yes |
| Timeout at 4000 ms | Same line | Yes |
| Offline, fetch rejects | Same line | Yes |
| JavaScript disabled or broken | The anchor is in the markup with a real `href` from the start | Yes |

The failure line, verbatim:

> **English:** "We could not save it here, so send it on WhatsApp instead. Nothing is lost."
> **Dutch:** "We konden het hier niet opslaan, stuur het daarom via WhatsApp. Er gaat niets verloren."

That is true, not reassuring noise: the whole request is in the WhatsApp text, so a failed save costs the back office a row, not the customer a booking.

Because the customer leaves the page on tap 2 and may never come back, everything they might need is rendered **before** the navigation, not after. There is no "thanks, we got it" screen waiting for a return that will not happen.

### The prefilled WhatsApp message

Built client side, URL encoded into `https://wa.me/<CFG.waNumber>?text=`. English example:

```
Hi Tex, I'd like to rent the Hyundai i10 (Economy).
From: Sat 14 Mar
Until: Fri 20 Mar (6 days)
Where: bring it to my hotel
Note: Divi Village, arriving 11:00
Name: Monischa
Estimate I saw: $210
```

The number comes from `site/data/config.js:25` (`waNumber`), described in that file as the single source for every WhatsApp link on the site. See the launch blocker in section 13: `site/scripts/main.js:7` still carries the comment "confirm live WhatsApp with owner" next to the fallback `2975945454`.

### The floating WhatsApp button must not exist on this page

`site/styles/main.css:269` defines `.wa-float`, a fixed 58 px green circle at `right: 18px; bottom: 18px; z-index: 60`, with a pulse animation at `:282`. Its markup is `site/index.html:415` and its href is `https://wa.me/2975945454` with **no** `?text=`.

On a 375 px screen it sits in the same thumb zone as the quiz's own green "Open WhatsApp" button, it pulses, and it opens an empty chat that throws the composed request away. The quiz page does not include that markup at all. Not hidden with CSS, simply not on the page.

***

## 7. The data contract

One table, one enum pair, one route. Everything else is superseded.

### The table

`src/lib/db/schema/booking-requests.ts`, exported from `src/lib/db/schema/index.ts` (which today ends at line 17 with `approvals`, so this becomes line 18).

```
request_status:   new | contacted | converted | dismissed
request_delivery: airport | hotel | pickup

booking_requests
  id                    uuid              primary key, default random
  status                request_status    not null, default 'new'
  car_key               text              not null
  vehicle_class         text              not null
  vehicle_name          text              not null
  start_date            date              not null
  end_date              date              not null
  delivery              request_delivery  not null
  delivery_note         text              not null, default ''
  name                  text              not null
  phone                 text              not null
  lang                  text              not null, default 'en'
  estimate_cents        integer
  estimate_currency     text              not null, default 'USD'
  dedup_key             text              not null, unique
  submission_count      integer           not null, default 1
  source                text              not null, default 'site-quiz'
  converted_booking_id  uuid              references bookings(id) on delete set null
  handled_at            timestamptz
  handled_by            uuid              references admin_users(id) on delete set null
  created_at            timestamptz       not null, default now()
  updated_at            timestamptz       not null, default now()

indexes: created_at, status, phone
```

Notes on four of those columns, since the table above carries no inline comments:

- `vehicle_class` and `vehicle_name` are derived on the server from `car_key`. They are never accepted from the client.
- `phone` is stored in the normalised form described in section 4, and is required per D5.
- `estimate_cents` is what the customer was shown. It is advisory and is never used to price anything.
- `estimate_currency` is derived on the server from `lang` (`pap` gives AWG, anything else gives USD), not sent by the client.
- `dedup_key` is the server computed SHA-256 from C1.

`admin_users` is the real table name (`src/lib/db/schema/admin.ts:9`).

### car_key is not a vehicle id, and this is the part people get wrong

`site/data/fleet.js:19` has `slug: "hyundai-i10"`. `app/scripts/seed.ts:45` has `slug: "hyundai-i10-v-7123"`. There is **zero** overlap across all six cards, because the site shows one representative car per model and the app tracks individual cars by plate.

So `car_key` is a lookup key into an allowlist that lives inside the app, and it is never joined to `vehicles.slug`. Prefill in the back office matches by **class**, never by slug.

### The server side car allowlist

New file, `src/lib/requests/catalog.ts`. A frozen map from the six keys to `{ name, class }`, taken from `site/data/fleet.js:19-24`:

```
hyundai-i10     -> { name: "Hyundai i10",     class: "Economy" }
ford-figo       -> { name: "Ford Figo",       class: "Economy" }
suzuki-baleno   -> { name: "Suzuki Baleno",   class: "Economy" }
hyundai-accent  -> { name: "Hyundai Accent",  class: "Compact" }
chevrolet-aveo  -> { name: "Chevrolet Aveo",  class: "Compact" }
kia-rio         -> { name: "Kia Rio",         class: "Compact" }
```

This exists so the display name shown to the owner is **derived server side**. An earlier draft accepted `vehicleName` as a free string from the client and printed it in an owner facing surface, which is unauthenticated attacker authored text in a trusted place. An unknown `car_key` is a 422.

Known limitation, stated up front: this map duplicates `fleet.js` and will drift if the six cards change. A comment goes at the top of `site/data/fleet.js` saying so, and a unit test asserts the six keys and classes match the ones the site ships.

### The request body

```json
{
  "carKey": "hyundai-i10",
  "startDate": "2027-03-14",
  "endDate": "2027-03-20",
  "delivery": "hotel",
  "deliveryNote": "Divi Village, arriving 11:00",
  "name": "Monischa",
  "phone": "+2975601234",
  "lang": "en",
  "estimateCents": 21000,
  "website": ""
}
```

`website` is the honeypot. The schema is `.strict()`, matching every other schema in this codebase, so an unknown key is a 422.

### The response

`201 { "ok": true }`. Nothing else. No id, no ref, no echo of anything stored, so the endpoint cannot be used to enumerate or confirm anything.

***

## 8. The public intake route

`src/app/api/booking-requests/route.ts`, with `export const runtime = "nodejs"` (needed for `crypto` and matching `src/app/api/quote/route.ts:10`).

### Order of operations

This mirrors the existing public write at `src/app/api/bookings/route.ts:26-28` exactly, because that ordering is the house pattern.

1. `enforceOrigin(req)`. Fail closed, with a Referer fallback and no substring matching (`src/lib/auth/csrf.ts:61`).
2. `await enforceRateLimit(req, "global", "booking-request")`. Per client, **not** `perScope`. See the abuse section below. The scope name `booking-request` collides with nothing in use today.
3. `await parseJsonBody(req, BodySchema, 4096)`, using the new `maxBytes` parameter from C6.
4. Honeypot: if `website` is a non empty string, return `201 { ok: true }` and write nothing. Same status, same body, same timing shape as a real success. The pattern is copied from FleetDesk's early access route at `~/Desktop/SaltyCode/04-Products/saltycodestudio-products/fleetdesk/src/app/api/early-access/route.ts:20-23` (the schema field) and `:40-43` (the silent 201).
5. Sanitise and normalise (below).
6. Look up `car_key` in the allowlist. Unknown key is a 422.
7. Compute `dedup_key`.
8. Insert with `onConflictDoUpdate` on `dedup_key`, `setWhere: status = 'new'`, updating `name`, `delivery_note`, `estimate_cents`, `lang`, `updated_at`, and incrementing `submission_count`.
9. Return `201 { ok: true }`.

It does **not** call `notifyAdmin`, `createApprovalRequest` or any email function. G3 holds by construction: `createApprovalRequest` is called from exactly one non test place, `src/app/api/bookings/route.ts:31`, and this route is not it, so the Telegram approval bot is untouched.

### Validation

| Field | Rule |
| - | - |
| `carKey` | one of the six allowlist keys |
| `startDate`, `endDate` | `isoDate` (`src/lib/validation/iso-date.ts:11`, which rejects impossible dates like 2027-02-30) |
| date range | `endDate` after `startDate`; span at most `settings.maxRentalDays` (90); `startDate` not before `arubaToday()` (`src/lib/booking/public.ts:18`); `startDate` at most `maxAdvanceDays` (365) ahead |
| `delivery` | one of `airport`, `hotel`, `pickup` |
| `deliveryNote` | 0 to 200 characters, no newlines |
| `name` | 2 to 60 characters |
| `phone` | strip spaces, dashes, dots, brackets; then optional `+` plus 8 to 17 digits |
| `lang` | `en` or `nl` |
| `estimateCents` | optional integer, 0 to 10000000 |
| `website` | must be absent or the empty string |

### Sanitising, and why it is not optional

Every free string (`name`, `phone`, `deliveryNote`) is passed through one shared `sanitiseLine()` helper that strips C0 and C1 control characters, zero width characters U+200B to U+200F, the bidi overrides U+202A to U+202E and the isolates U+2066 to U+2069, and the line and paragraph separators U+2028 and U+2029, then trims and collapses runs of whitespace.

React escaping genuinely holds here, so this is not about cross site scripting: `dangerouslySetInnerHTML` and `innerHTML` together return zero hits across `app/src`. It is about a right to left override character visually reordering a row in the owner's inbox, and about that same string later being copied into `bookings.notes` and rendered in the booking drawer. A regex of the form `^[^\r\n]*$`, which an earlier draft used, permits every one of these characters.

### Abuse controls, which are launch blockers under G5

**1. The client IP is forged today, and that is a live defect on the existing public booking endpoint.**

`clientIdentifier()` reads the **leftmost** `x-forwarded-for` hop (`src/lib/http/rate-limit.ts:105-107`) whenever `TRUST_PROXY` is set, and `wrangler.jsonc:79` sets `TRUST_PROXY: "true"`. `trustedClientIp()` has the identical shape (`src/lib/http/client-ip.ts:10-17`) and feeds the audit trail at `src/lib/audit.ts:32`. The Worker forwards the inbound request verbatim (`worker/index.ts:108-111`), and `cf-connecting-ip` appears nowhere in `src/` or `worker/`. Cloudflare appends to `x-forwarded-for` rather than overwriting it, so the leftmost hop is whatever the caller typed. The limiter's own docblock states the precondition this deployment does not meet, at `rate-limit.ts:69-76`: it assumes an edge that overwrites rather than appends.

So every per IP limit on all 26 `enforceRateLimit` call sites in production routes (28 including the two inside `src/test/rate-limit-perscope.test.ts`) is defeated by rotating one header, right now, including `POST /api/bookings` and the admin login. **This is not fixed. It is fixed by Phase 0 of the runbook in section 14, and until that ships G5 is not met.** Fixing it is also what bounds the limiter's in memory `Map` (`rate-limit.ts:22`), which today grows one entry per forged address per window inside the single container that also serves the entire back office.

**2. No `perScope`.** An earlier draft proposed `perScope: true` keyed on the scope alone (the option is documented at `rate-limit.ts:175-181`). With the default of 100 per 60 seconds (`src/env.ts:160-161`), that is a switch one attacker flips to turn the inbox off for every real customer for the rest of the window. Per client only.

**3. A Cloudflare rate limiting rule as the outer layer**, on `http.request.uri.path eq "/api/booking-requests"` and method POST. This is the right layer for a volumetric control because Cloudflare uses the real client address by definition, with no header to trust. Threshold to start: 10 requests per minute per address, action managed challenge. Owner action, in the dashboard, and it must name the same path as C2.

**4. A real 4 KB body cap**, via the `maxBytes` parameter added in C6. Not the header pre-check alone, which is documented as insufficient in its own docblock at `validate.ts:73-81`.

**5. The honeypot**, per step 4 above.

One header the quiz cannot read: `Errors.rateLimited` sets `Retry-After` (`src/lib/http/errors.ts:78-79`) but `src/lib/http/cors.ts:36` exposes only `X-RateLimit-Remaining` and `X-RateLimit-Reset`. The quiz never reads it and never retries, so this costs nothing, but no future code should assume it is readable.

### CORS needs no change

`wrangler.jsonc:78` already lists `https://tex-cars.com` and `https://www.tex-cars.com`. `worker/index.ts:33` forwards the variable, `src/env.ts:48-73` parses it, `src/lib/http/cors.ts:19` loads it into the allowlist, and `src/middleware.ts:17-22` answers `OPTIONS` before any route with a matcher at `:32` that covers `/api`. A route level `OPTIONS` export would be dead code. Nothing to do.

***

## 9. Privacy, consent, retention and deletion

### What is stored, and nothing more

Name, WhatsApp number, car, dates, delivery choice, one optional note, language, the estimate the customer saw. No email, no address, no licence, no payment detail, no IP address on the request row, no user agent, no analytics identifier.

The audit log does record an IP for admin actions (`src/lib/audit.ts:32`), and until Phase 0 lands that value can be forged. That is stated in the policy text as a known limitation of the current logging, not glossed over.

### The published privacy policy is a launch blocker

G4. No personal data may be stored before the policy is live at `https://app.tex-cars.com/policies/privacy`.

Three things about publishing that are easy to get wrong:

1. **There is no draft state.** `src/lib/admin/policies.ts:31` inserts with `published_at = now()` on save. Whatever is typed goes live immediately.
2. **It renders as plain text**, inside a `<pre>` (`src/app/(public)/policies/[type]/page.tsx:26`), despite the admin form labelling the field "Body (Markdown)" (`src/app/admin/(shell)/policies/page.tsx:167`). Markdown syntax will show as literal asterisks. Paste plain text with blank lines between paragraphs. It does wrap on mobile (`src/app/(public)/public.css:838` sets `white-space: pre-wrap`), so long lines are fine.
3. **Whether a published privacy row exists on the live database cannot be checked from the code.** The route and the page type both exist and both accept `privacy` (`src/app/api/policies/[type]/route.ts` and the page above), but the body lives in Postgres. Somebody has to open the admin and look.

The policy must name, in plain words: that a phone number is stored; that it is stored so Tex can reply on WhatsApp; that it is kept for 90 days and then deleted; who to write to for access, correction or deletion, with a reply promised inside 30 days; and the honest WhatsApp limit, which is that deleting the record on Tex's side does not delete the chat from WhatsApp, and that the conversation will also be deleted from the business phone on request.

### Retention, one rule

`REQUEST_RETENTION_DAYS = 90`, a constant in `src/lib/requests/retention.ts`. A new `sweepBookingRequests()` hard deletes every row whose `created_at` is older than 90 days, and it is added as a fourth chore in `src/app/api/cron/expire-holds/route.ts` alongside the three at `:31-33`, returning a count into the same log line at `:34` and the same JSON response at `:35`. It is idempotent, so running it every 15 minutes costs one cheap query per tick.

The number 90 appears in exactly three places and they must be changed together: the constant, the published policy text, and the consent line in section 6. This is why C4 rejected a settings column.

### Deletion on request, the working path

A person writes in and asks. The owner opens `/admin/requests`, searches the phone number they wrote from, and taps Delete on the matching rows. The delete is a real row delete and it is audited through the standard `mutate` wrapper (`src/lib/admin/guard.ts:31-58`, which writes the audit entry at `:48-56`), so there is a record that a deletion happened without keeping the deleted data.

Search by phone works because phone is required (D5) and normalised on the way in. This is the concrete reason D5 matters beyond convenience: without a phone column there is no reliable key to find a person's rows by.

### One more thing about where data lives

The marketing site repo is public on GitHub (`origin` is `https://github.com/Salty-Code-studio/tex-cars-rental.git`, and `.gitignore:15-16` excludes `backups/` with the comment that prod database dumps must never reach this public repo). No request data, no exported list, no screenshot with a real phone number in it ever goes into `site/`.

***

## 10. The back office

### The request inbox

New page, `/admin/requests`, owner and staff (staff already create manual bookings at `src/app/api/admin/bookings/route.ts:23`, so denying them the requests that feed those bookings would be strange). New link in `LINKS` in `src/app/admin/(shell)/side-nav.tsx:11-21`, marked `staff: true`, with the count of `new` requests beside it.

The list is newest first, filtered by status, with a search box that matches phone and name. Each row shows: when it arrived, the car and class, the dates, the delivery choice and note, the name, the phone, the estimate the customer saw, and the status. Styling reuses `table.grid` and the `.tag` classes already in `src/app/admin/admin.css:191-202`, and the empty states follow the three the audit page already has (`src/app/admin/(shell)/audit/page.tsx:95-127`).

Four actions per row:

- **Message on WhatsApp.** Opens `https://wa.me/<normalised phone>` in a new tab. Admin only, so `target="_blank"` is fine here; the in app webview problem in C7 is a customer side problem.
- **Create booking from this.** Section below.
- **Dismiss.** Sets `dismissed`, `handled_at`, `handled_by`.
- **Delete.** For section 9's erasure path.

### The trust rule, written on the page

A short line at the top of the inbox, always visible:

> "These are requests, not bookings. Nothing here is reserved. Confirm on WhatsApp before you promise a car."

### Convert to a booking

"Create booking from this" opens the existing create panel with what we have prefilled, and asks the desk for what we do not have.

Prefilled: customer name, phone, the two dates, and the note (delivery choice plus free text, written as one line into `bookings.notes`).

Not prefilled, because we genuinely do not know it: **the specific car** and **the times**. The request carries a class, not a vehicle. The desk picks the actual plate from a dropdown of vehicles in that class. This is the honest consequence of the slug mismatch in section 7, and pretending otherwise would put the wrong plate on a contract.

While we are in there, one long standing gap gets closed. `CreatePanel` (`src/app/admin/(shell)/page.tsx:579`, in a 777 line file) has no car field and no date fields at all: its only inputs are at lines 646, 648, 649, 651, 652, 653 and 654, and the vehicle and the dates ride on the popover type at `:50`, set only by dragging on the board at `:200` and read at `:596-597`. To open it from a request rather than from a drag, a car selector and two date fields have to be added. The patterns already exist and get copied: the `Select` in `ServiceModal` at `:764`, `flatVehicles` at `:119` passed down at `:517`, and the `.bd-dates` grid at `booking-drawer.tsx:474-479`. `BoardPopover` (defined at `:529`, mounted at `:499-507`) does not currently receive `vehicles`, so that has to be threaded through to the `CreatePanel` call at `:572`.

Then the two step, non atomic flow from C10: create the booking, then mark the request converted. Read C10 again before writing this code. It is not a transaction and it must not be described as one.

### Numbers, and what they honestly cover

The inbox header shows requests in the last 30 days, how many converted, and the percentage. Because rows are hard deleted at 90 days (section 9), no window longer than 90 days is available, and the page says so in one line rather than showing a number that quietly resets.

***

## 11. Every site surface that moves

There are four booking entry points, not two, and one of them is generated in JavaScript.

| Where | Today | After |
| - | - | - |
| `site/index.html:62`, nav | `data-booking-href="/book"`, rewritten by the bridge to `app.tex-cars.com/book` | `href="/book/"`, attribute removed, `target` and `rel` removed |
| `site/index.html:102`, hero | same | same |
| `site/index.html:403`, footer | same | same |
| `site/scripts/main.js:100`, fleet cards | `href="${bookUrl({ class: car.class })}"`, generated for all six cards and re-rendered on `langchange` at `:257` | `bookUrl` returns `/book/?car=${car.slug}` |

The fleet card link exists only in JavaScript. No edit to `index.html` reaches it, and four of the five earlier designs would have shipped six live links into the fenced off wizard.

Dropping `data-booking-href` from the three anchors takes them out of the bridge's rewrite loop (`site/scripts/booking-bridge.js:33-45`) without changing the bridge itself. The label swap at `:47-61` is a separate loop keyed on `data-book-en`, so labels still work. The labels change: `data-en`, `data-nl`, `data-book-en` and `data-book-nl` on all three anchors all become "Request a car" and "Vraag een auto aan", so the booking flag no longer changes the wording of a call to action that now means the same thing either way.

### Other site edits

- **New page `site/book/index.html`** plus **new `site/scripts/quiz.js`** and quiz styles appended to `site/styles/main.css`. `site/book/` does not exist yet.
- **The quiz page loads exactly four scripts**: `data/config.js`, `data/fleet.js`, `scripts/i18n.js`, `scripts/quiz.js`. It does **not** load `main.js` (which would render a fleet grid, the retired inquiry form and the wa.me links it does not need) and it does **not** load `booking-bridge.js` (which would rewrite links onto the app origin and undo the whole change).
- **Guard `localStorage` in `site/scripts/i18n.js`.** Line 15 calls `localStorage.getItem(KEY)` unguarded inside the top level `DEFAULT` immediately invoked function at `:14`, and line 39 calls `setItem`. Under Safari's "Block All Cookies" and inside partitioned in app webviews both throw `SecurityError`, and a throw at line 15 aborts the whole function so `window.TEX_i18n` is never defined and the `langchange` event at `:40` never fires. Dutch would silently never render and the quiz's language driven estimate re-render would never run. Wrap both in `try`/`catch`. This fixes the homepage too.
- **Retire the homepage inquiry form** (D6) and replace it with a short call to action block: one line of copy and one button to `/book/`.
- **Fix the live 404 at `site/index.html:386`.** It links `/policies/rental-terms` with a hyphen; the app's `policy_type` enum accepts only `rental_terms` with an underscore (`src/lib/db/schema/admin.ts:5`). Since `site/data/config.js:21` has `bookingEnabled: true`, the bridge reveals that link today (`booking-bridge.js:64` unhides every `data-booking-only` block), so it is a live 404 in production right now. Change the hyphen to an underscore.
- **Add `/book/` to `site/sitemap.xml`**, which today has four URLs (the homepage, the blog index and two blog posts) and none of them the quiz. `robots.txt` is already `Allow: /`, so nothing to do there.
- **A config kill switch.** Add `requestsOn: true` to `site/data/config.js`, mirroring `bookingEnabled` at `:21`. When false, the quiz skips the POST entirely and goes straight to the WhatsApp anchor. This is the one minute rollback in section 14 and it needs no app deploy.

***

## 12. Every app surface that moves

- **New:** `src/lib/db/schema/booking-requests.ts`, `src/lib/requests/catalog.ts`, `src/lib/requests/create.ts`, `src/lib/requests/retention.ts`, `src/lib/admin/requests.ts`, `src/app/api/booking-requests/route.ts`, `src/app/api/admin/booking-requests/route.ts` and its `[id]/route.ts`, `src/app/admin/(shell)/requests/page.tsx`.
- **Changed:** `src/lib/db/schema/index.ts` (one export line), `src/lib/http/validate.ts` (the optional `maxBytes` parameter from C6, defaulted so all 36 existing non-test call sites are untouched), `src/app/api/cron/expire-holds/route.ts` (a fourth chore), `src/app/admin/(shell)/side-nav.tsx` (one link), `src/app/admin/(shell)/page.tsx` (a car selector and two date fields in `CreatePanel`, plus threading `vehicles` through `BoardPopover`), `next.config.ts` (the redirect below), `src/app/(public)/policies/[type]/page.tsx` (the link below), `worker/index.ts` (Phase 0, shipped separately), `wrangler.jsonc` (line 22 only, and only at deploy time).
- **Generated, never hand written:** `drizzle/0025_*.sql`, its snapshot in `drizzle/meta/`, and the entry in `drizzle/meta/_journal.json`. See section 14.
- **Not changed:** `src/lib/db/schema/notifications.ts` (C8), `src/lib/admin/manual-booking.ts` (C10), `src/lib/http/cors.ts` and `wrangler.jsonc`'s CORS list at `:78` (nothing to do), `vercel.json` (no new cron), `src/middleware.ts`.

### Fencing off the wizard

`next.config.ts` gets a `redirects()` entry sending `/book` and `/book/:path*` to `https://tex-cars.com/book/`, with `permanent: false`. Temporary on purpose: a 307 is undone by deleting three lines, a 308 is cached in browsers for a long time and is not.

The wizard's page file at `src/app/(public)/book/page.tsx` stays on disk untouched. This is a redirect, not a deletion, so re-enabling online booking later is a small revert.

### The link that would break, and does not

`src/app/(public)/policies/[type]/page.tsx:29` renders `<a href="/book">` as the privacy page's **only** navigation. That is the page G4 makes a launch blocker, and fencing `/book` would turn it into a redirect out to the site and away from the policy the customer was reading. It changes to the absolute `https://tex-cars.com/book/` with the label "Back to Tex Cars". No earlier design mentioned this.

***

## 13. Launch blockers

One list. Nothing on it is a follow up. Nothing below is done, tested or verified yet.

| # | Blocker | Whose call | Why it blocks |
| - | - | - | - |
| 1 | Publish the privacy policy at `app.tex-cars.com/policies/privacy` | Tex, with the owner login (Mo if she holds it) | G4. No personal data may be stored first. Publishing is immediate and has no draft state. Nobody can confirm from the code whether a row exists; somebody has to open the admin and look. |
| 2 | Ship the client IP fix in the Worker | Mo | G5. Every per IP limit on all 26 production call sites is forgeable today, including on the live `POST /api/bookings`. This is a defect in production right now, not a new risk. |
| 3 | Confirm the live WhatsApp number | Tex | `site/scripts/main.js:7` still carries the comment "confirm live WhatsApp with owner" beside the fallback `2975945454`, and `config.js:25` feeds every link on the site. If it is wrong, every request goes to the wrong phone. |
| 4 | Approve the 90 day retention number | Tex | It has to be identical in the constant, the published policy and the consent line. Changing it later means changing all three. |
| 5 | Approve the customer facing copy in sections 4, 5 and 6 | Mo, then Tex | The estimate sentence and the consent sentence are legal and commercial commitments, not decoration. |
| 6 | Add the Cloudflare rate limiting rule on `/api/booking-requests` | Mo, in the dashboard | G5. The in app limiter is per container and resets on every deploy (`rate-limit.ts:22`). |
| 7 | The real 4 KB body cap (the `maxBytes` parameter) | Mo | G5. Without it the endpoint takes a 1 MB body from any chunked request. |
| 8 | The retention sweep wired into `expire-holds` and proven to run | Mo | G4. A policy promising 90 days with a sweep that never fires is worse than no policy. Proof is the smoke test in section 14 Phase 3. |
| 9 | Migration 0025 generated, journalled and applied, and verified by looking at the database | Mo | A migration that is not in the journal exits 0 and creates nothing. See section 14. |

Two items that are **not** blockers, recorded so nobody spends time on them: CORS needs no change, and the `OPTIONS` preflight is already answered by the middleware.

***

## 14. The deploy runbook

Three independent artifacts, two git repositories, one database. In this order, the site never posts to an endpoint that does not exist and the endpoint never writes to a table that does not exist.

**The two repositories matter.** The parent repo's `.gitignore` opens with `app/` at line 2, and `git ls-files app` returns zero files. The app is its own git repository. The site reaches production only through a subtree push to the `gh-pages` branch, which exists on `origin`. **Pushing `main` alone deploys nothing for the site.** Commits are separate, always.

### Phase 0, the client IP fix. Worker only, ship it days earlier.

Edit `worker/index.ts` in the `fetch` handler at `:108-111`: delete any inbound `x-forwarded-for` and `x-real-ip`, and rewrite them from `cf-connecting-ip`. Prefer `cf-connecting-ip` in `trustedClientIp()` (`src/lib/http/client-ip.ts:10`) and `clientIdentifier()` (`src/lib/http/rate-limit.ts:105`).

Leave `wrangler.jsonc:22` alone, then run `npx wrangler deploy`. No container rebuild, no image push. Do **not** change `INSTANCE_ID` at `worker/index.ts:105`; a new durable object identifier means no environment injection, which means 500s everywhere.

Rollback: revert the file and deploy again. Seconds.

Cannot be checked from disk, so smoke it after: post to a route with a forged `x-forwarded-for` and confirm the rate limit bucket does not move. Whether `cf-connecting-ip` survives the Worker to container hop is not determinable statically.

### Phase 1, publish the privacy policy. No code.

Owner signs in at `app.tex-cars.com/admin`, goes to Policies, writes the plain text body, publishes. Verify `app.tex-cars.com/policies/privacy` shows "Version 1". Immediate, no draft, renders as plain text.

### Phase 2, the database.

1. Generate the migration with `npm run db:generate` (`package.json:19`, which runs drizzle-kit generate). **Never hand write it.** A hand written `.sql` that is not in `drizzle/meta/_journal.json` is never read by the migrator, and `npm run db:migrate` then reports success and exits 0 having created nothing.
2. Confirm the journal. The last entry today is `idx 24`, tag `0024_magenta_captain_midlands`, `when 1788762713330`. The new entry's `when` must be **greater** than that number, or it is skipped silently on the live database while a fresh local run stays green. This repo has already been bitten by that four separate times, at 0015 and 0016, at 0018, at 0023 and at 0024; the mechanism and the binding remap formula are written up in `app/docs/PORT-LOG.md:232`, Note 9(b).
3. Run `npx vitest run src/test/migration-incremental-upgrade.test.ts` and get it green. That test already exists, no earlier design mentioned it, and it is the right gate: it migrates from an older committed state with real data and it statically asserts strictly increasing `when` values. Add one read after write assertion for `booking_requests` in the same style as the existing 0024 block.
4. Run `npm run typecheck`, `npm run lint` and `npm test` (`package.json:16-18`). The container image build skips type checking and linting when `DOCKER_BUILD=1` (`next.config.ts:22` and `:41-46`), so this is the only gate.
5. Take a Supabase backup.
6. From the `app` directory, with the full environment export block set **in the shell**. `npm run db:migrate` loads `.env.local` if it exists (`package.json:20`), and `src/lib/db/migrate.ts:24` falls back to `DATABASE_URL` when `DATABASE_MIGRATION_URL` is missing, so a forgotten export silently points the DDL at the development database. Export it explicitly.
7. `npm run db:migrate`.
8. **Verify by looking, not by trusting the exit code.** `select count(*) from booking_requests;` must succeed, and `select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1;` must return the new `when`. Exit 0 with nothing applied is the expected failure mode here.

The whole pending batch runs inside one transaction, so there is no half applied state to clean up after a failure.

Rollback: `BEGIN; DROP TABLE booking_requests; DROP TYPE request_status; DROP TYPE request_delivery; DELETE FROM drizzle.__drizzle_migrations WHERE created_at = <the when value>; COMMIT;` then delete the `.sql`, its snapshot and the journal entry, or the next migrate re-applies it. Note the journal holds no hash; the hash is a runtime SHA-256 of the file body, so `created_at` is the only key an operator can produce by hand. Zero impact on bookings. The DDL is additive and the running container does not know the table exists.

### Phase 3, the app image.

1. Run `docker builder prune` first. Colima disk at 85 percent or above kills container builds silently.
2. Build the image with `npx wrangler containers build`, tagging it `tex-cars-app:requests-<sha>`, from the app directory.
3. `docker save` the image to a tar, then `crane push` it under that **new** tag. Never overwrite `polish-a003b5a`; that tag is the rollback. The comment at `wrangler.jsonc:20-21` explains why this three step dance exists.
4. **Edit `wrangler.jsonc:22` to the new tag and commit that change on its own.** That line pins a literal registry tag, not `./Dockerfile`. **This edit is the deploy.** Skipping it makes the next step redeploy the old image, which the repo's own runbook says at `app/GO-LIVE-PARITY.md:231-232` and which the git history follows (`a8928b1 deploy: image ref polish-a003b5a`).
5. `npx wrangler deploy`.
6. Smoke it. `/api/health` returns ok with `db: true`. A POST to `/api/booking-requests` with an `Origin` of `https://tex-cars.com` and a JSON body returns 201, and the row lands and renders in the admin inbox. A GET to `/api/cron/expire-holds` with the cron bearer token returns ok **with the new sweep counter in the response**, which is the only proof that the retention chore is actually wired.

Rollback: set `wrangler.jsonc:22` back to `polish-a003b5a` and deploy. No rebuild, about a minute.

In flight impact: `INSTANCE_ID` pins a single container, so a deploy replaces the one instance. The desk loses the admin board for the cold start window, and the in memory rate limiter resets. Do this outside desk hours, or set the Upstash Redis URL and token as Worker secrets first so the limiter survives. Whether those secrets are already set cannot be determined from the repo; they are on the forwarding allowlist at `worker/index.ts:44-45` but the values are not in the code.

### Phase 4, the site. Last, and from the parent repo.

1. Commit `site/book/index.html`, `site/scripts/quiz.js`, the style additions, the four repointed call to action surfaces, the `i18n.js` try/catch, the retired homepage form, the `rental_terms` fix and the sitemap entry.
2. Ship with `requestsOn: false` in `site/data/config.js`, so the quiz works end to end on WhatsApp while the POST is still off.
3. Push `main`, **then** run the subtree push: `git subtree push` with the prefix set to `site`, to `origin gh-pages`. The push to `main` alone deploys nothing.
4. Smoke the live page on a real phone, in Safari and inside the Instagram in app browser.
5. Flip `requestsOn: true` in a second commit and repeat step 3.

Rollback: the subtree push refuses a non fast forward, so an older tree cannot be pushed. The rollback is `git revert` on `main` followed by another subtree push, two commands and one Pages rebuild. Flipping `requestsOn` back to false is the faster kill switch and needs no app change. Customers are unaffected either way, because under G1 a dead POST still opens WhatsApp.

### Why this order

Site last is what makes "never posts to an endpoint that does not exist" true. It is not strictly required, since G1 turns a 404 into the WhatsApp path anyway, but any request sent during a site first window is lost with no record, and shipping a form that collects a phone number before Phase 1 breaks G4 outright.

App before migration is the one genuinely broken order: the endpoint 500s on a missing relation, and because the sweep is bolted into `expire-holds`, that route starts failing every fifteen minutes. It fails after `expireStaleHolds` has already run (`expire-holds/route.ts:31`), and that call no-ops in desk mode anyway (its own comment says so at `:29-30`), so the damage is log noise rather than stuck holds. Still avoidable for free by migrating first.

***

## 15. Known limits, and what we are deliberately not doing

**Limits that are real and are not being fixed in this piece of work:**

- Nothing verifies that the phone number is real, or that it is on WhatsApp, or that the person typing it owns it.
- A customer can type one number and message from another. The desk falls back to matching on car plus dates plus name.
- The car allowlist in `src/lib/requests/catalog.ts` duplicates `site/data/fleet.js` and drifts if the six cards change. A unit test catches the drift; nothing prevents it.
- The estimate is computed in the browser and stored as advisory text. It is not a quote and no code path treats it as money.
- Conversion is two statements and is not atomic. See C10.
- The requests inbox does not push. If nobody opens the admin, nobody is told. The customer's WhatsApp message is the notification.
- Conversion statistics only cover the last 90 days, because rows are hard deleted at 90 days.
- The in app rate limiter is per container and resets on every deploy. The Cloudflare rule is the control that survives.
- The audit log's IP column is forgeable until Phase 0 ships, and even after Phase 0 nothing retroactively corrects the rows already written.
- Whether a published privacy policy row exists on the live database, and whether the Upstash secrets are set, cannot be answered from the code. Both need somebody to look.
- The `/policies/rental-terms` link on `site/index.html:386` is a 404 in production today. This work fixes it, but it is broken right now.

**Deliberately out of scope:**

- Any Telegram alert per request. G3.
- Any email to the customer or to the owner on a request. Note for whoever comes later: `src/lib/email/templates.ts:100-105` says in its own comment that every template except the booking confirmation renders unescaped, so nobody may add a "new request" email without fixing the escape helper first.
- Availability checking in the quiz. It would imply a hold, and G2 forbids holds.
- Any change to the `notifications` table. C8.
- A transaction inside `createManualBooking`. C10.
- A new cron. C9.
- A settings column for the retention number. C4.
- A reference code. C5.
- Payments of any kind. The quiz collects no money and mentions none beyond the estimate and the deposit footnote.

**Open questions for Tex, which do not block the build but do block the launch:**

1. The exact privacy policy wording, in section 9's required shape.
2. Whether `2975945454` is still the live business WhatsApp number.
3. Whether 90 days is the right retention window.
4. Whether "I collect it at Tex" should name the actual address on the page, or stay generic.
