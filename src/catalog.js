// ─────────────────────────────────────────────────────────────
// EDIT THIS FILE to set prices, designs, dates and stock.
// Everything the site shows and charges comes from here.
// ─────────────────────────────────────────────────────────────

export const TOUR = {
  artist: "Begum",
  name: "We Are Okay! Tour",
};

// Order matches the tour routing.
// code: short name shown big on the city tiles, like the poster.
// date: what fans see. null shows "Date soon".
// ordersCloseAt: when pre-orders stop for that city (IST).
//   e.g. "2026-09-30T23:59:00+05:30". null keeps it open.
export const CITIES = [
  { id: "delhi",     code: "DEL", name: "Delhi",     venue: "Odella",           date: "9th Oct",  ordersCloseAt: null },
  { id: "goa",       code: "GOA", name: "Goa",       venue: "Hideaway",         date: "10th Oct", ordersCloseAt: null },
  { id: "mumbai",    code: "MUM", name: "Mumbai",    venue: "Raasta",           date: "15th Oct", ordersCloseAt: null },
  { id: "bangalore", code: "BLR", name: "Bangalore", venue: "The Humming Tree", date: "16th Oct", ordersCloseAt: null },
];

export const SIZES = ["S", "M", "L", "XL", "XXL"];

// price: pre-order price in rupees (what the site charges).
// venuePrice: what the same tee costs at the merch table on the night.
//   Shown crossed out so fans see the saving. null hides it.
// image: path under /public, e.g. "img/tee-a.jpg" (no leading slash).
// With no image, the site draws a plain tee in `color`.
export const DESIGNS = [
  {
    id: "tee-a",
    name: "Design A",
    blurb: "Replace with a one-line description of the print.",
    price: 1000,
    venuePrice: 1200,
    image: null,
    color: "#B03850",
  },
  {
    id: "tee-b",
    name: "Design B",
    blurb: "Replace with a one-line description of the print.",
    price: 1000,
    venuePrice: 1200,
    image: null,
    color: "#175AA4",
  },
];

// Size chart in inches, shown under the tees. null hides it.
// Get these from your printer before launch.
export const SIZE_CHART = null;
// export const SIZE_CHART = {
//   S:   { chest: 38, length: 27 },
//   M:   { chest: 40, length: 28 },
//   L:   { chest: 42, length: 29 },
//   XL:  { chest: 44, length: 30 },
//   XXL: { chest: 46, length: 31 },
// };

// Stock caps per city, design and size. null = unlimited (print to order).
// Leave out any city/design/size to make that one unlimited.
export const STOCK_CAPS = null;
// export const STOCK_CAPS = {
//   goa:    { "tee-a": { S: 10, M: 25, L: 25, XL: 15, XXL: 5 }, "tee-b": { S: 10, M: 25, L: 25, XL: 15, XXL: 5 } },
//   delhi:  { "tee-a": { S: 15, M: 40, L: 40, XL: 20, XXL: 8 } },
// };

export const LIMITS = { maxPerLine: 5, maxPerOrder: 10 };

// How long an unpaid order holds stock. Razorpay checkout times out at 15 min.
export const HOLD_MINUTES = 20;

// ── helpers ───────────────────────────────────────────────────
export const findCity = (id) => CITIES.find((c) => c.id === id);
export const findDesign = (id) => DESIGNS.find((d) => d.id === id);
export const sku = (city, design, size) => `${city}:${design}:${size}`;

export function isCityOpen(city, now = Date.now()) {
  return !city.ordersCloseAt || now < Date.parse(city.ordersCloseAt);
}

export function capFor(city, design, size) {
  const v = STOCK_CAPS?.[city]?.[design]?.[size];
  return typeof v === "number" ? v : null;
}
