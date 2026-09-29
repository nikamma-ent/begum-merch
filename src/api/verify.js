import { markPaid, itemsFor, publicOrder } from "../store.js";
import { json, fail, hmacHex, safeEqual } from "../util.js";

// Called by the browser right after Razorpay checkout succeeds.
export async function onRequestPost({ request, env, waitUntil }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return fail("Missing payment details.");
  }
  const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = b || {};
  if (!oid || !pid || !sig) return fail("Missing payment details.");

  const expected = await hmacHex(String(env.RAZORPAY_KEY_SECRET).trim(), `${oid}|${pid}`);
  if (!safeEqual(expected, sig)) return fail("This payment couldn't be verified.", 400);

  const order = await markPaid(env, { waitUntil }, oid, pid);
  if (!order) return fail("We couldn't find this order.", 404);

  return json(publicOrder(order, await itemsFor(env.DB, order.id)));
}
