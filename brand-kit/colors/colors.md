# Tex Cars & Leasing — Brand Colors

Extracted directly from the **official logo files** (client-provided, `LOGO_TEXCARS_Rental & leasing`).
Values sampled from `LOGO COLOUR.png` and `LOGO BLUE ORANGE.png`. These are confirmed brand colors,
not guesses.

| | HEX | RGB | Role | Source |
|---|-----|-----|------|--------|
| 🟦 | `#0044FF` | 0, 68, 255 | **Primary — Electric Blue** | Car swoosh + blue-variant scene/road |
| 🟧 | `#FF4600` | 255, 70, 0 | **Accent — Orange** | "CAR RENTAL" lockup + "Easily from A to B" |
| 🟦 | `#15192F` | 21, 25, 47 | **Ink / Navy** | "TEX CARS" wordmark (primary text color) |
| ⬛ | `#000000` | 0, 0, 0 | Neutral — Black | Scene silhouettes (palm/anchor/car/lighthouse) |
| ⬜ | `#FFFFFF` | 255, 255, 255 | Base — White | Logo background |

## Usage guidance (saltycodestudio)
- **Electric Blue `#0044FF`** = primary brand color. Buttons, links, key accents, the swoosh motif. It's vivid — use on white, give it space; avoid large blue fills behind body text.
- **Orange `#FF4600`** = high-energy accent for CTAs ("Book on WhatsApp", "Reserve"), price tags, and the "from A to B" tagline. Pairs with blue for the brand's blue+orange signature. Don't overuse — accent only.
- **Navy `#15192F`** = default heading/body text color (softer than pure black, matches the wordmark).
- **Black** = reserve for the badge/illustration silhouettes, not UI text.
- **WhatsApp green** (#25D366) is an outside color — only on the literal WhatsApp button icon, never as a brand color.

## Suggested web tokens
```css
--brand-blue:   #0044FF;
--brand-orange: #FF4600;
--brand-navy:   #15192F;
--brand-black:  #000000;
--brand-white:  #FFFFFF;
/* tints for backgrounds */
--blue-50:  #EEF3FF;
--orange-50:#FFF1EC;
```

> Note: the supplied files are **raster PNGs** (despite "VECTOR" in some filenames). For crisp scaling
> on the site we should **request a true vector (SVG/AI/EPS)** — but the PNGs are high-res enough to
> ship the first version.
