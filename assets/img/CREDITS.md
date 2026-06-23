# Image credits

## Real Tex Cars photography (owner-provided, 2026-06-22)
These are the owner's own photos, resized for web from the originals in
`brand-kit/photography/`:

**Hero / header**
- `hero-lighthouse.jpg` — California Lighthouse at sunset (from `lighthouse.jpg`)
- `hero-cars.jpg` — Tex Cars on the Aruba coast (from `cars.png`)
- `hero-anchor.jpg` — the blue anchor monument (from `ancor.jpg`)

**Fleet (real cars, correctly matched)**
- `car-ford-figo.jpg` — gold Ford Figo (from `DSC07067`)
- `car-hyundai-accent.jpg` — white Hyundai Accent (from `DSC07134`)
- `car-kia-rio.jpg` — silver Kia Rio (from `DSC07066`)

## Still placeholders (Pexels, free license)
The June 2026 photo shoot only contained three cars (Ford Figo, Hyundai Accent,
Kia Rio). These three models were NOT photographed, so they still use stock
placeholders chosen for the closest body style, and the fleet section keeps its
"photos are representative" flag:
- `car-economy.jpg` (hatchback) → **Hyundai i10**, **Suzuki Baleno**
- `car-compact.jpg` (sedan) → **Chevrolet Aveo**

⚠️ **To finish:** shoot the i10, Baleno, and Aveo in the same coast/beauty-shot
style and drop them in, then point those `data/fleet.js` entries at the new files
and the disclaimer can be removed.

Other unused stock (`car-suv.jpg`, `car-suv2.jpg`, `car-4x4.jpg`, `car-van.jpg`)
remain from the original class-based set. `car-placeholder.svg` is the built-in
fallback used if an image fails to load.
