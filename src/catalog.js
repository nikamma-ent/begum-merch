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
// image / imageBack: paths under /docs, e.g. "img/tee-a.jpg" (no leading
//   slash). imageBack adds a Front/Back switch; null hides it.
// With no image, the site draws a plain tee in `color`.
export const DESIGNS = [
  {
    id: "tee-a",
    name: "We Are Okay! Tour Tee",
    blurb: "Mustard tee. BEGUM and roses on the front, the tour poster and dates on the back.",
    price: 1000,
    venuePrice: 1200,
    image: "img/tee-tour-front.jpg",
    imageBack: "img/tee-tour-back.jpg",
    color: "#E0B32A",
  },
  {
    id: "tee-b",
    name: "All My Friends Tee",
    blurb: "Lavender tee with \u201call my friends are sl\u{1F339}ts\u201d on the front.",
    price: 1000,
    venuePrice: 1200,
    image: "img/tee-amfs.jpg",
    imageBack: null,
    color: "#9C86C4",
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

// Stock caps per design and size. null = unlimited (print to order).
// "all" is one pool shared by every show: a tee sold for Delhi is one fewer
// for Bangalore. A city's own entry (e.g. goa: {...}) would give that city a
// separate pool instead. Leave out a design/size to make it unlimited.
const TOUR_SPLIT = { S: 10, M: 14, L: 14, XL: 8, XXL: 4 }; // 50 per design

export const STOCK_CAPS = {
  all: { "tee-a": TOUR_SPLIT, "tee-b": TOUR_SPLIT },
};

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

export function capFor(pool, design, size) {
  const v = STOCK_CAPS?.[pool]?.[design]?.[size];
  return typeof v === "number" ? v : null;
}

// Which stock counter an item for this city draws from, and its cap.
export function stockFor(city, design, size) {
  const pool = capFor(city, design, size) !== null ? city : capFor("all", design, size) !== null ? "all" : city;
  return { key: sku(pool, design, size), cap: capFor(pool, design, size) };
}
