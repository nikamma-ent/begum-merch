import { SIZES, LIMITS, findCity, findDesign, isCityOpen } from "../catalog.js";
import { reserve, release, sweepExpired, itemsSummary } from "../store.js";
import { createRazorpayOrder } from "../razorpay.js";
import { json, fail, orderCode } from "../util.js";

// Creates a pending order, holds stock, and opens a Razorpay order for it.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Something went wrong reading your order. Refresh the page and try again.");
  }

  const city = findCity(body.city);
  if (!city) return fail("Pick a show for pickup.");
  if (!isCityOpen(city)) return fail(`Pre-orders for ${city.name} have closed.`);

  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return fail("Enter your name as it should appear on the pickup list.");

  let phone = String(body.phone || "").replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  if (!/^[6-9]\d{9}$/.test(phone)) return fail("Enter a 10-digit Indian mobile number.");

  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return fail("Enter a valid email address.");

  // Merge duplicate lines and validate.
  const merged = new Map();
  for (const raw of Array.isArray(body.items) ? body.items : []) {
    const design = findDesign(raw?.design);
    const size = String(raw?.size || "");
    const qty = Number(raw?.qty);
    if (!design || !SIZES.includes(size) || !Number.isInteger(qty) || qty < 1) return fail("One of the items in your order isn't valid.");
    const key = `${design.id}:${size}`;
    merged.set(key, { design: design.id, size, qty: (merged.get(key)?.qty || 0) + qty, unitPrice: design.price * 100 });
  }
  const items = [...merged.values()];
  if (!items.length) return fail("Your order is empty.");
  if (items.some((i) => i.qty > LIMITS.maxPerLine)) return fail(`You can order up to ${LIMITS.maxPerLine} of each design and size.`);
  const totalQty = items.reduce((n, i) => n + i.qty, 0);
  if (totalQty > LIMITS.maxPerOrder) return fail(`You can order up to ${LIMITS.maxPerOrder} tees at once.`);

  const amount = items.reduce((n, i) => n + i.qty * i.unitPrice, 0);

  await sweepExpired(env.DB);
  const held = await reserve(env.DB, city.id, items);
  if (!held.ok) {
    const d = findDesign(held.soldOut.design);
    return fail(`Not enough ${d.name} in ${held.soldOut.size} left for ${city.name}. Lower the quantity or pick another size.`, 409, {
      soldOut: held.soldOut,
    });
  }

  const code = orderCode();
  let rzp;
  try {
    rzp = await createRazorpayOrder(env, {
      amount,
      receipt: code,
      notes: {
        order_code: code,
        pickup_city: city.name,
        venue: city.venue,
        name,
        phone,
        items: itemsSummary(items).slice(0, 250),
      },
    });
  } catch (e) {
    console.error(e);
    await release(env.DB, city.id, items);
    return fail("Payments aren't available right now. Try again in a few minutes.", 502);
  }

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO orders (id, city, name, phone, email, amount, status, rzp_order_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8)"
    ).bind(code, city.id, name, phone, email, amount, rzp.id, now),
    ...items.map((i) =>
      env.DB.prepare("INSERT INTO order_items (order_id, design, size, qty, unit_price) VALUES (?1, ?2, ?3, ?4, ?5)").bind(
        code, i.design, i.size, i.qty, i.unitPrice
      )
    ),
  ]);

  return json({ code, rzpOrderId: rzp.id, amount, keyId: String(env.RAZORPAY_KEY_ID).trim(), name, email, phone });
}
