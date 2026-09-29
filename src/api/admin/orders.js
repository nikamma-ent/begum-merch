import { CITIES, findCity, findDesign } from "../../catalog.js";
import { safeEqual, toCsv } from "../../util.js";

// Pickup lists and print counts as CSV.
//   /api/admin/orders?token=XXX                 all paid orders
//   /api/admin/orders?token=XXX&city=goa        one city's pickup list
//   /api/admin/orders?token=XXX&view=summary    counts per city, design, size (for the printer)
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const admin = String(env.ADMIN_TOKEN || "").trim();
  if (!admin || !safeEqual(token, admin)) return new Response("Not allowed", { status: 401 });

  const city = url.searchParams.get("city");
  if (city && !findCity(city)) {
    return new Response(`Unknown city. Use one of: ${CITIES.map((c) => c.id).join(", ")}`, { status: 400 });
  }
  const view = url.searchParams.get("view") === "summary" ? "summary" : "orders";
  const cityClause = city ? " AND o.city = ?1" : "";
  const bind = (stmt) => (city ? stmt.bind(city) : stmt);

  let rows;
  if (view === "summary") {
    const { results } = await bind(
      env.DB.prepare(
        `SELECT o.city, i.design, i.size, SUM(i.qty) AS qty FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.status = 'paid'${cityClause} GROUP BY o.city, i.design, i.size ORDER BY o.city, i.design, i.size`
      )
    ).all();
    rows = [
      ["City", "Design", "Size", "Quantity"],
      ...results.map((r) => [findCity(r.city)?.name, findDesign(r.design)?.name || r.design, r.size, r.qty]),
    ];
  } else {
    const { results: orders } = await bind(
      env.DB.prepare(`SELECT * FROM orders o WHERE o.status = 'paid'${cityClause} ORDER BY o.city, o.name COLLATE NOCASE`)
    ).all();
    const { results: items } = await bind(
      env.DB.prepare(
        `SELECT i.* FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status = 'paid'${cityClause} ORDER BY i.design, i.size`
      )
    ).all();
    const byOrder = {};
    for (const i of items) (byOrder[i.order_id] ||= []).push(`${findDesign(i.design)?.name || i.design} / ${i.size} x${i.qty}`);
    rows = [
      ["City", "Order code", "Name", "Phone", "Email", "Items", "Amount (INR)", "Paid at (IST)", "Payment ID", "Picked up"],
      ...orders.map((o) => [
        findCity(o.city)?.name,
        o.id,
        o.name,
        o.phone,
        o.email,
        (byOrder[o.id] || []).join("; "),
        o.amount / 100,
        new Date(o.paid_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        o.rzp_payment_id,
        "",
      ]),
    ];
  }

  const name = `begum-${view}${city ? "-" + city : ""}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
