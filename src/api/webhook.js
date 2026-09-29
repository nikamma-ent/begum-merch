import { markPaid } from "../store.js";
import { hmacHex, safeEqual } from "../util.js";

// Razorpay calls this on payment events. Backup for buyers who close the tab mid-payment.
export async function onRequestPost({ request, env, waitUntil }) {
  const raw = await request.text();
  const sig = request.headers.get("x-razorpay-signature") || "";
  const expected = await hmacHex(String(env.RAZORPAY_WEBHOOK_SECRET).trim(), raw);
  if (!safeEqual(expected, sig)) return new Response("Invalid signature", { status: 400 });

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const p = event.payload?.payment?.entity;
    if (p?.order_id && p?.id) await markPaid(env, { waitUntil }, p.order_id, p.id);
  }
  return new Response("ok");
}
