import { TOUR, CITIES, DESIGNS, SIZES, SIZE_CHART, LIMITS, isCityOpen } from "../catalog.js";
import { availability, sweepExpired } from "../store.js";
import { json } from "../util.js";

export async function onRequestGet({ env }) {
  await sweepExpired(env.DB);
  return json({
    tour: TOUR,
    cities: CITIES.map((c) => ({ id: c.id, code: c.code, name: c.name, venue: c.venue, date: c.date, open: isCityOpen(c) })),
    designs: DESIGNS.map((d) => ({ id: d.id, name: d.name, blurb: d.blurb, price: d.price, venuePrice: d.venuePrice ?? null, image: d.image, color: d.color })),
    sizes: SIZES,
    sizeChart: SIZE_CHART,
    limits: LIMITS,
    availability: await availability(env.DB),
  });
}
