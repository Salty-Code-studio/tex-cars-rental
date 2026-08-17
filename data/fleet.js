/* ============================================
   fleet.js — Tex Cars fleet (representative cars per class)
   Mirrors the Phase 2 `vehicles` table 1:1 (see
   docs/2026-06-11-phase2-booking-system-spec.md §12).
   Real fleet + rates from the owner's "UITLEEN 2025" sheet (Jun 2026).

   TWO price lists (the site shows the right one per language):
     • Afl. (Aruban florin) for locals — shown in Papiamento. Deposit Afl. 500.
     • USD ($) for visitors — shown in English / Dutch / Spanish. Deposit $250.
   Florin day/month come straight from the sheet; USD is the owner's
   visitor rate (sheet shows ~$40/day, $250 deposit). Week is interpolated.

   The full fleet is ~34 cars (mostly Hyundai i10/Accent, Ford Figo,
   Kia Rio, Chevrolet Aveo, Suzuki); these cards show one of each model
   per class. All six cards use the owner's real car photos
   (Aug 2026 set, see assets/img/CREDITS.md).
   ============================================ */
window.TEX_FLEET = [
  { id: "eco-1", slug: "hyundai-i10",   class: "Economy", name: "Hyundai i10",    seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDay: 50, priceWeek: 300, priceMonth: 1150, usdDay: 35, usdWeek: 210, usdMonth: 700, deposit: 500, usdDeposit: 250, status: "active", image: "assets/img/car-hyundai-i10.jpg" },
  { id: "eco-2", slug: "ford-figo",     class: "Economy", name: "Ford Figo",      seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDay: 55, priceWeek: 330, priceMonth: 1300, usdDay: 40, usdWeek: 240, usdMonth: 800, deposit: 500, usdDeposit: 250, status: "active", image: "assets/img/car-ford-figo.jpg" },
  { id: "eco-3", slug: "suzuki-baleno", class: "Economy", name: "Suzuki Baleno",  seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDay: 40, priceWeek: 240, priceMonth: 900,  usdDay: 30, usdWeek: 180, usdMonth: 600, deposit: 500, usdDeposit: 250, status: "active", image: "assets/img/car-suzuki-baleno.jpg" },
  { id: "comp-1", slug: "hyundai-accent", class: "Compact", name: "Hyundai Accent", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDay: 60, priceWeek: 350, priceMonth: 1300, usdDay: 40, usdWeek: 240, usdMonth: 800, deposit: 500, usdDeposit: 250, status: "active", image: "assets/img/car-hyundai-accent.jpg" },
  { id: "comp-2", slug: "chevrolet-aveo", class: "Compact", name: "Chevrolet Aveo", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDay: 55, priceWeek: 330, priceMonth: 1200, usdDay: 38, usdWeek: 225, usdMonth: 750, deposit: 500, usdDeposit: 250, status: "active", image: "assets/img/car-chevrolet-aveo.jpg" },
  { id: "comp-3", slug: "kia-rio",        class: "Compact", name: "Kia Rio",        seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDay: 55, priceWeek: 330, priceMonth: 1200, usdDay: 38, usdWeek: 225, usdMonth: 750, deposit: 500, usdDeposit: 250, status: "active", image: "assets/img/car-kia-rio.jpg" },
];

/* Rate table derived from the fleet (cheapest active car per class),
   exactly how Phase 2 computes it: rates live on vehicles, the class
   table is a view. The class list itself is derived too, so adding a
   car with a new class automatically reaches the table and the form.
   Each row carries BOTH currencies; main.js picks per language.
   A car with no status field counts as active (safe default). */
const TEX_CLASS_ORDER = ["Economy", "Compact", "SUV", "4x4", "Van"];
window.TEX_ACTIVE = (c) => !c.status || c.status === "active";
window.TEX_RATES = [...new Set(window.TEX_FLEET.filter(window.TEX_ACTIVE).map((c) => c.class))]
  .sort((a, b) => {
    const ia = TEX_CLASS_ORDER.indexOf(a), ib = TEX_CLASS_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  })
  .map((cls) => {
    const cars = window.TEX_FLEET.filter((c) => c.class === cls && window.TEX_ACTIVE(c));
    const min = (key) => Math.min(...cars.map((c) => c[key]));
    return {
      class: cls,
      priceDay: min("priceDay"), priceWeek: min("priceWeek"), priceMonth: min("priceMonth"),
      usdDay: min("usdDay"), usdWeek: min("usdWeek"), usdMonth: min("usdMonth"),
    };
  });
