# Copy for Tex to approve: the WhatsApp request quiz and three homepage lines

Building the new WhatsApp request quiz at tex-cars.com/book/ meant writing a lot of small sentences the original spec never spelled out: error messages, calendar hints, a screen heading, a button label. The spec's own copy (the four quiz steps, the estimate sentence, the send step) was already approved by Tex through a separate sign-off and is not repeated here. This sheet is everything else: every string this build had to invent, plus one line that had to be rewritten because the spec's original version made a promise the quiz no longer keeps.

**What I need from you:** read every row. If a line is fine as written, leave it. If you want it changed, strike it through and write your version next to it. Each table says which page the customer sees it on and which build task wrote it, so whoever picks up the change knows exactly which file to open.

Nothing on this sheet is about saving customer data. The quiz does not save anything, so there is nothing here about storage, retention, or deletion.

---

## 1. The consent line (read this one first)

This is the line at the bottom of the last screen, right above the button that opens WhatsApp. It is the only place on the page that tells the customer what happens to their information, so it is the most important row on this sheet.

| | English | Dutch |
|---|---|---|
| **Ships today** | "This opens WhatsApp with your details ready to send. You press send yourself, and nothing is reserved until Tex confirms it." | "Dit opent WhatsApp met je gegevens klaar om te versturen. Je drukt zelf op verzenden, en er is niets gereserveerd tot Tex het bevestigt." |

**Where:** /book/, the send screen, above the "Send it on WhatsApp" button.
**Task:** 5

**What this replaced, and why.** The spec's original consent line read: *"Tap send and we save your name, your WhatsApp number and the choices above so Tex can answer you. Nothing is reserved yet. We delete it after 90 days. Privacy policy."* That sentence describes a save, a 90 day retention clock, and a privacy policy link. None of those exist in this build. The quiz composes a WhatsApp message and stops there; it never sends anything to a server and never stores anything on the device. Shipping the original sentence would have put a false claim about customer data on a live page, so it was rewritten to say only what actually happens.

There is deliberately no privacy policy link on this line anymore either. A policy link implies a data collection notice, and there is nothing here to give notice about: nothing is collected, nothing is kept, nothing is shared. If a future version of the quiz adds a save (the back office side of this feature is deferred, not cancelled), this line becomes false again the day that ships, and has to be rewritten in the same piece of work.

---

## 2. The trust line, the send screen, and the last thing the customer taps

The trust line sits above the progress dots at the very top of the quiz, so it is the first thing a customer reads. The heading and the button are on the final screen; the button is the literal last thing anyone taps on this site before they leave for WhatsApp, so it is worth a slow read.

| String | English | Dutch | Where |
|---|---|---|---|
| Trust line | "Nothing is reserved until Tex confirms it on WhatsApp." | "Er is niets gereserveerd tot Tex het op WhatsApp bevestigt." | /book/, above the progress dots, every screen |
| Send screen heading | "Send it to Tex" | "Stuur het naar Tex" | /book/, top of the last screen |
| Send button label | "Send it on WhatsApp" | "Stuur het via WhatsApp" | /book/, the button itself, last tap on the site |

**Task:** 5 (all three)

---

## 3. The five error messages

These only appear if a customer tries to continue without filling something in, or picks something the page cannot accept. Each row says exactly when it fires.

| Error | When it fires | English | Dutch | Task |
|---|---|---|---|---|
| No car picked | Customer taps Continue on step 1 with no car selected | "Tap the car you would like." | "Tik de auto aan die je wil." | 7 |
| No valid date range | Customer taps Continue on step 2 with no pick-up day, no return day, or a return day that is not after the pick-up day | "Tap a pick-up day and a return day on the calendar." | "Tik een ophaaldag en een terugbrengdag aan op de kalender." | 7 |
| Pick-up day has passed | Customer picked today as the pick-up day, then stayed on the page past midnight in Aruba, so that day is no longer valid | "That pick-up day has passed. Tap a new one." | "Die ophaaldag is al voorbij. Tik een nieuwe aan." | 9 (review fix) |
| Rental too long | The span between pick-up and return is more than 90 days | "Ninety days is the longest we can take here. Ask Tex on WhatsApp for a longer rental." | "Negentig dagen is het langste dat hier kan. Vraag Tex op WhatsApp naar een langere huur." | 7 |
| No drop-off choice | Customer taps Continue on step 3 without picking airport, hotel, or pick up at Tex | "Tell us where you would like the car." | "Vertel ons waar je de auto wil hebben." | 7 |
| No name | Customer taps Continue on step 4 with a name under 2 characters or over 60 | "We need a name so Tex knows who to answer." | "We hebben een naam nodig, zodat Tex weet wie hij antwoordt." | 7 |

Two of these are worth calling out by name:

- **"Pick-up day has passed"** did not exist in the first version of the quiz. It was added during code review because the generic "tap a pick-up day" message actively misdescribes what happened to a customer who crosses the Aruba midnight boundary while sitting on this step: they did tap a day, it just aged out from under them while they were still looking at the page. The old message would have told them they had done something they had, in fact, already done correctly.
- **"Rental too long"** names the number ninety on purpose. Ninety days is the longest rental this page can compose a WhatsApp message for; a customer who wants four months is told why, rather than being told to just tap the calendar again.

---

## 4. The calendar hint line

There is one line of grey helper text under the calendar on step 2, and it changes as the customer taps. Two of its three states are new copy this build had to invent; the third was already in the approved spec and is included here only so the full set reads together.

| State | When it shows | English | Dutch | New or already approved | Task |
|---|---|---|---|---|---|
| Before any day is tapped | Step 2 loads, no pick-up day chosen yet | "Tap your pick-up day." | "Tik je ophaaldag aan." | New | 7 |
| After the pick-up day is tapped | A pick-up day is set, no return day yet | "Now tap your return day." | "Tik nu je terugbrengdag aan." | New | 7 |
| After a mis-tap reset | Customer taps a day at or before the current pick-up day, or taps a third day once a range is already complete; both wipe the range and start over | "Start date moved to [day]. Now tap your return day." (example: "Start date moved to Sat 14 Mar. Now tap your return day.") | "Startdatum verplaatst naar [dag]. Tik nu je terugbrengdag aan." (example: "Startdatum verplaatst naar za 14 mrt. Tik nu je terugbrengdag aan.") | Already approved, spec copy, shown for context only | 7, wired in 8 |

The mis-tap line exists because the reference calendar this quiz was ported from (the Little John Scooters booking widget) wiped both dates silently on a mis-tap and said nothing to the customer. This build always announces the reset instead. That line's wording came from the spec and is not up for review here; it is only in this table so the full set of hint states can be read in one place instead of two.

---

## 5. The WhatsApp message itself

This is what actually lands in the customer's own WhatsApp chat with Tex when they press send. It is built from their answers and shown exactly as their phone will display it. This message is now the only record of the request anywhere: there is no saved copy, no database row, nothing else. Anything missing from this text is missing, full stop.

The English version is spec copy, approved already, and shown here only so it sits next to the Dutch for comparison. The Dutch version is new and has not been reviewed by a native speaker.

**English** (spec copy, for comparison only)
```
Hi Tex, I'd like to rent the [car name] ([car class]).
From: [pick-up date]
Until: [return date] ([n] days)
Where: [bring it to the airport / bring it to my hotel / I collect it at Tex]
Note: [drop-off note, only if the customer wrote one]
Name: [customer name]
Estimate I saw: [amount]
```

**Dutch** (new, needs review)
```
Hoi Tex, ik wil graag de [autonaam] ([autoklasse]) huren.
Van: [ophaaldatum]
Tot: [terugbrengdatum] ([n] dagen)
Waar: [breng hem naar het vliegveld / breng hem naar mijn hotel / ik haal hem op bij Tex]
Opmerking: [aflevernotitie, alleen als de klant er een schreef]
Naam: [klantnaam]
Schatting die ik zag: [bedrag]
```

**Where:** the text that pre-fills when a customer taps "Send it on WhatsApp" on /book/.
**Task:** 4

**One line for Tex specifically.** The Dutch line "Schatting die ik zag:" (literally "Estimate I saw:") was flagged during review as reading a little stiff, like a direct translation of the English "Estimate I saw." A native Dutch speaker might prefer it shortened to just "Schatting:" It was kept as the literal mirror of the English on purpose, because the matching phrasing signals to Tex that the customer is quoting back a figure the page showed them, not asserting a price they expect to pay. That reasoning may or may not outweigh how it reads. Tex decides.

---

## 6. The no-JavaScript fallback

If a customer's browser has JavaScript turned off, the quiz cannot build itself, so the page shows this instead: a short explanation and a plain WhatsApp link that works without any script running.

| String | English | Dutch |
|---|---|---|
| Heading | "Message Tex on WhatsApp" | "Stuur Tex een bericht op WhatsApp" |
| Paragraph | "This page needs JavaScript to build your request. Tap below and tell Tex which car and which days." | "Deze pagina heeft JavaScript nodig om je aanvraag op te bouwen. Tik hieronder en vertel Tex welke auto en welke dagen." |
| Button | "Open WhatsApp" | "Open WhatsApp" |

**Where:** /book/, only visible with JavaScript disabled.
**Task:** 5

---

## 7. The new homepage call to action

This replaced the old inquiry form on the homepage (the one with name, email, date, and car fields). It is the one paragraph and one button that now sit in the "Reserve your car" section, pointing to the quiz.

| String | English | Dutch |
|---|---|---|
| Paragraph | "Pick your car, tap your days, tell us where you want it, and leave your WhatsApp number. Nothing is reserved until Tex confirms it." | "Kies je auto, tik je dagen aan, vertel ons waar je hem wil hebben en laat je WhatsApp nummer achter. Er is niets gereserveerd tot Tex het bevestigt." |
| Button | "Request a car" | "Vraag een auto aan" |

**Where:** homepage, "Reserve your car" section, where the old inquiry form used to be.
**Task:** 12

---

## 8. Three homepage claims that had to be rewritten

These three lines on the homepage described the old app-based booking flow: a reservation fee, a licence upload before pickup, and online payment. The quiz does none of that. It takes no payment, it does not ask for licence details, and there is no reservation fee, so the old wording would have promised something the site no longer does. All three changed only on the wording that was actually broken; every plain claim that just says "online" (the trust badge, the "Book online" heading, "book it online in minutes") was left alone, because booking through WhatsApp is still booking online.

The site carries four language versions of each line: English and Dutch are live today; Spanish and Papiamento exist in the file but are currently switched off (see the open items at the end), so they are shown here for completeness, not because they are visible to customers right now.

### 8a. The "how it works" step line

| | English | Dutch | Spanish | Papiamento |
|---|---|---|---|---|
| **Before** | "Pick your car and dates online and lock it in with a small reservation fee. Done in minutes." | "Kies online je auto en data en leg 'm vast met een kleine reserveringsfee. In een paar minuten geregeld." | "Elige tu auto y tus fechas online y asegúralo con una pequeña tarifa de reserva. Listo en minutos." | "Skohe bo outo i bo fechanan online i sigurá e ku un tarifa chikí di reservashon. Kla den un par di minüt." |
| **After** | "Pick your car and your days online, and Tex answers you on WhatsApp. Done in minutes." | "Kies online je auto en je dagen, en Tex antwoordt je op WhatsApp. In een paar minuten geregeld." | "Elige tu auto y tus días online, y Tex te responde por WhatsApp. Listo en minutos." | "Skohe bo outo i bo dianan online, i Tex ta kontestá bo via WhatsApp. Kla den un par di minüt." |

**Where:** homepage, "How it works" steps, the "Message us" step.

### 8b. FAQ: "What do I need to rent?"

Only the answer changed; the question stayed the same in every language.

| | English | Dutch | Spanish | Papiamento |
|---|---|---|---|---|
| **Before** | "A valid driver's license and a form of ID. When you book online we ask for your license details upfront, so pickup stays quick and easy." | "Een geldig rijbewijs en een identiteitsbewijs. Boek je online, dan vragen we je rijbewijsgegevens vooraf, zo gaat het ophalen extra snel." | "Una licencia de conducir válida y una identificación. Al reservar online te pedimos los datos de tu licencia por adelantado, así la entrega es más rápida." | "Un karnet di chofer válido i un identifikashon. Ora bo reservá online, nos ta pidi e datonan di bo karnet promé, asina entrega ta bai mas lihé." |
| **After** | "A valid driver's license and a form of ID. Drivers need to be 21 or older. You show the license when you pick the car up, so there is nothing to fill in beforehand." | "Een geldig rijbewijs en een identiteitsbewijs. Je bent minimaal 21 jaar. Je laat je rijbewijs zien bij het ophalen, dus vooraf hoef je niets in te vullen." | "Una licencia de conducir válida y una identificación. Los conductores deben tener 21 años o más. Muestras la licencia al recoger el auto, así que no hay nada que rellenar antes." | "Un karnet di chofer válido i un identifikashon. Chofer mester tin 21 aña òf mas. Bo ta mustra bo karnet ora bo buska e outo, pues no tin nada pa yena promé." |

**Where:** homepage, FAQ section.

### 8c. FAQ: the online payment question, renamed and rewritten

| | English | Dutch | Spanish | Papiamento |
|---|---|---|---|---|
| **Before, question** | "How does paying online work?" | "Hoe werkt online betalen?" | "¿Cómo funciona el pago online?" | "Kon pago online ta funshoná?" |
| **After, question** | "How do I pay?" | "Hoe betaal ik?" | "¿Cómo pago?" | "Kon mi ta paga?" |
| **Before, answer** | "You lock your booking with a small reservation fee, or pay the full deposit online if you prefer. Want to pay the deposit in cash at pickup? That works too; the reservation fee still holds your car." | "Je legt je boeking vast met een kleine reserveringsfee, of je betaalt de volledige borg direct online. Liever de borg cash bij het ophalen? Dat kan ook; de reserveringsfee houdt je auto dan vast." | "Aseguras tu reserva con una pequeña tarifa de reserva, o pagas el depósito completo online si lo prefieres. ¿Quieres pagar el depósito en efectivo al recibir el auto? También se puede; la tarifa de reserva mantiene tu auto apartado." | "Bo ta sigurá bo reservashon ku un tarifa chikí di reservashon, òf bo ta paga e depósito kompleto online si bo ke. Bo ke paga e depósito kèsh ora bo haña e outo? Esei tambe por; e tarifa di reservashon ta tene bo outo pa bo." |
| **After, answer** | "You pay Tex when you pick the car up. Nothing is charged on this website, and sending a request costs you nothing." | "Je betaalt Tex bij het ophalen. Op deze website wordt niets afgeschreven, en een aanvraag versturen kost je niets." | "Pagas a Tex al recoger el auto. En esta web no se cobra nada, y enviar una solicitud no cuesta nada." | "Bo ta paga Tex ora bo buska e outo. Riba e website aki no ta kobra nada, i manda un petishon no ta kosta bo nada." |

**Where:** homepage, FAQ section, the payment question.
**Task for all of 8a, 8b, 8c:** 15

---

## What is still open, and needs Tex specifically

1. **Confirm the live WhatsApp number.** Every WhatsApp link on the site, including the whole quiz, is built from one number: `2975945454`. `site/scripts/main.js` line 7 still carries a comment reading "confirm live WhatsApp with owner" next to that number, and it has never been signed off as correct. The number is now hardcoded in five separate places across the codebase (the site config, the homepage script, the quiz script, and two spots in the quiz page markup), and an automated test in `tools/site-tests/markup.test.mjs` checks that all five agree with each other, but nothing checks that the number itself is right. With no back office and no saved copy of any request, a wrong number here means a request reaches nobody at all, silently. This is the single most important thing to verify before this page sends real customers to WhatsApp.

2. **Approve the estimate and deposit sentences.** These two lines appear on the send screen, under the recap of what the customer chose, and they are commercial commitments, not decoration:
   - Estimate: "Estimate: [amount] for [n days]. Tex confirms the final price on WhatsApp." / Dutch: "Schatting: [bedrag] voor [n dagen]. Tex bevestigt de definitieve prijs via WhatsApp."
   - Deposit: "A refundable deposit of [amount] is arranged when you pick the car up. It is not part of this estimate." / Dutch: "Een borg van [bedrag] regel je bij het ophalen. Die valt buiten deze schatting."

   Both were written into the original spec and are not new copy, but they set a customer's expectation about price before Tex has said a word, so they belong on this list as a final check rather than something approved once and forgotten.
