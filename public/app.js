(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  // Local dev talks to `wrangler dev`; the live site uses the address in index.html.
  const API = ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:8787"
    : (document.querySelector('meta[name="api-base"]')?.content || "").replace(/\/$/, "");
  const LAST_ORDER_KEY = "begum-wao-last-order";

  const state = { cfg: null, city: null, cart: [], picks: {}, busy: false };

  const design = (id) => state.cfg.designs.find((d) => d.id === id);
  const city = (id) => state.cfg.cities.find((c) => c.id === id);
  const left = (d, s) => (state.city ? state.cfg.availability?.[state.city]?.[d]?.[s] ?? null : null);
  const cartQty = () => state.cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => state.cart.reduce((n, l) => n + l.qty * design(l.design).price, 0);
  const saving = (d) => (d.venuePrice > d.price ? d.venuePrice - d.price : 0);
  const cartSaving = () => state.cart.reduce((n, l) => n + l.qty * saving(design(l.design)), 0);
  const lineFor = (d, s) => state.cart.find((l) => l.design === d && l.size === s);

  // ── boot ────────────────────────────────────────────────────
  async function loadConfig() {
    const res = await fetch(`${API}/api/config`, { cache: "no-store" });
    if (!res.ok) throw new Error("config");
    state.cfg = await res.json();
  }

  async function init() {
    try {
      await loadConfig();
    } catch {
      $("#loading").textContent = "The merch table didn't load. Check your connection and refresh the page.";
      return;
    }
    $("#loading").remove();
    document.querySelectorAll(".step").forEach((s) => (s.hidden = false));
    $("#shop").setAttribute("aria-busy", "false");
    renderCities();
    renderDesigns();
    renderSizeChart();
    renderSummary();
    showReturning();
    $("#details").addEventListener("submit", onPay);
  }

  // ── step 1: cities ──────────────────────────────────────────
  function renderCities() {
    const wrap = $("#cities");
    wrap.innerHTML = state.cfg.cities
      .map((c) => {
        const when = c.open ? (c.date ? esc(c.date) : "Date soon") : "Closed";
        return `<button type="button" class="city" role="radio" aria-checked="${state.city === c.id}" data-city="${c.id}" ${c.open ? "" : "disabled"}
          aria-label="${esc(c.name)}, ${esc(c.venue)}, ${c.open ? (c.date ? esc(c.date) : "date soon") : "pre-orders closed"}">
          <span class="city-code">${esc(c.code || c.name)}</span><span class="city-date">${when}</span><span class="city-venue">${esc(c.venue)}</span></button>`;
      })
      .join("");
    wrap.querySelectorAll(".city").forEach((b) =>
      b.addEventListener("click", () => {
        state.city = b.dataset.city;
        renderCities();
        renderDesigns();
        renderSummary();
        wrap.querySelector(`[data-city="${state.city}"]`)?.focus();
      })
    );
  }

  // ── step 2: designs ─────────────────────────────────────────
  function teeSvg(color) {
    return `<svg viewBox="0 0 200 190" role="img" aria-label="T-shirt">
      <path d="M68 12 L40 22 L6 52 L28 82 L46 70 L46 182 L154 182 L154 70 L172 82 L194 52 L160 22 L132 12 C126 30 114 38 100 38 C86 38 74 30 68 12 Z"
        fill="${esc(color)}" stroke="#5A1A2A" stroke-width="3" stroke-linejoin="round"/></svg>`;
  }

  function renderDesigns() {
    const { sizes, designs } = state.cfg;
    $("#designs").innerHTML = designs
      .map((d) => {
        const chips = sizes
          .map((s) => {
            const n = left(d.id, s);
            const out = n !== null && n <= 0;
            return `<button type="button" class="size" data-size="${s}" aria-pressed="${state.picks[d.id] === s}" ${out ? "disabled" : ""}
              aria-label="${s}${out ? ", sold out" : ""}">${s}</button>`;
          })
          .join("");
        const art = d.image ? `<img src="${esc(d.image)}" alt="${esc(d.name)} tee" loading="lazy">` : teeSvg(d.color);
        return `<article class="design" data-design="${d.id}">
          <div class="art">${art}</div>
          <div class="design-head"><h3>${esc(d.name)}</h3><span class="price">${inr(d.price)}${saving(d) ? ` <s class="was" aria-label="${inr(d.venuePrice)} at the show">${inr(d.venuePrice)}</s>` : ""}</span></div>
          ${saving(d) ? `<p class="deal">Pre-order price. It's ${inr(d.venuePrice)} at the merch table on the night.</p>` : ""}
          ${d.blurb ? `<p class="blurb">${esc(d.blurb)}</p>` : ""}
          <fieldset class="sizes"><legend>Size</legend>${chips}</fieldset>
          <p class="left" aria-live="polite">${stockNote(d.id)}</p>
          <button type="button" class="add">Add to order</button>
          <p class="msg" aria-live="polite"></p>
        </article>`;
      })
      .join("");

    document.querySelectorAll(".design").forEach((card) => {
      const id = card.dataset.design;
      card.querySelectorAll(".size").forEach((b) =>
        b.addEventListener("click", () => {
          state.picks[id] = b.dataset.size;
          card.querySelectorAll(".size").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          card.querySelector(".left").textContent = stockNote(id);
          card.querySelector(".msg").textContent = "";
        })
      );
      card.querySelector(".add").addEventListener("click", () => addToCart(id, card));
    });
  }

  function stockNote(id) {
    const s = state.picks[id];
    if (!s) return "";
    const n = left(id, s);
    if (n === null) return "";
    if (n <= 0) return `${s} is sold out for ${city(state.city).name}.`;
    return n <= 10 ? `Only ${n} left in ${s} for ${city(state.city).name}.` : "";
  }

  function addToCart(id, card) {
    const msg = card.querySelector(".msg");
    msg.classList.remove("err");
    const size = state.picks[id];
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    if (!size) return say("Choose a size first.", true);

    const { maxPerLine, maxPerOrder } = state.cfg.limits;
    const line = lineFor(id, size);
    const have = line ? line.qty : 0;
    if (cartQty() >= maxPerOrder) return say(`You can order up to ${maxPerOrder} tees at once.`, true);
    if (have >= maxPerLine) return say(`You can order up to ${maxPerLine} of each size.`, true);
    const n = left(id, size);
    if (n !== null && have + 1 > n) return say(`Only ${n} left in ${size} for ${city(state.city).name}.`, true);

    if (line) line.qty++;
    else state.cart.push({ design: id, size, qty: 1 });
    say(`Added ${design(id).name} in ${size}. You have ${have + 1} in this size.`);
    renderSummary();
  }

  function renderSizeChart() {
    const chart = state.cfg.sizeChart;
    if (!chart) return;
    const rows = Object.entries(chart)
      .map(([s, m]) => `<tr><th scope="row">${esc(s)}</th><td>${esc(m.chest)} in</td><td>${esc(m.length)} in</td></tr>`)
      .join("");
    $("#sizechart").innerHTML = `<details class="chart"><summary>Size chart</summary>
      <div class="chart-scroll"><table><thead><tr><th scope="col">Size</th><th scope="col">Chest</th><th scope="col">Length</th></tr></thead>
      <tbody>${rows}</tbody></table></div></details>`;
  }

  // ── step 3: summary + pay ───────────────────────────────────
  function renderSummary() {
    const el = $("#summary");
    const c = state.city ? city(state.city) : null;
    const pickup = c ? `Pickup at ${esc(c.venue)}, ${esc(c.name)}` : "Pick a show above for pickup.";

    if (!state.cart.length) {
      el.innerHTML = `<h3>Your order</h3><p class="pickup">${pickup}</p><p class="empty">Nothing here yet. Add a tee above.</p>`;
    } else {
      const { maxPerLine, maxPerOrder } = state.cfg.limits;
      const lines = state.cart
        .map((l, i) => {
          const d = design(l.design);
          const n = left(l.design, l.size);
          const canAdd = l.qty < maxPerLine && cartQty() < maxPerOrder && (n === null || l.qty < n);
          const over = n !== null && l.qty > n;
          return `<li class="line">
            <span class="line-name">${esc(d.name)}, ${l.size}${over ? ` <em>(only ${n} left here)</em>` : ""}</span>
            <span class="line-price">${inr(d.price * l.qty)}</span>
            <span class="qty">
              <button type="button" data-i="${i}" data-d="-1" aria-label="One less ${esc(d.name)} ${l.size}" ${l.qty <= 1 ? "disabled" : ""}>−</button>
              <output aria-label="Quantity">${l.qty}</output>
              <button type="button" data-i="${i}" data-d="1" aria-label="One more ${esc(d.name)} ${l.size}" ${canAdd ? "" : "disabled"}>+</button>
            </span>
            <button type="button" class="remove" data-i="${i}">Remove</button>
          </li>`;
        })
        .join("");
      el.innerHTML = `<h3>Your order</h3><p class="pickup">${pickup}</p><ul class="lines">${lines}</ul>
        <p class="total"><span>Total</span><span>${inr(cartTotal())}</span></p>
        ${cartSaving() ? `<p class="saved">You save ${inr(cartSaving())} on the venue price.</p>` : ""}`;
      el.querySelectorAll(".qty button").forEach((b) =>
        b.addEventListener("click", () => {
          state.cart[+b.dataset.i].qty += +b.dataset.d;
          renderSummary();
        })
      );
      el.querySelectorAll(".remove").forEach((b) =>
        b.addEventListener("click", () => {
          state.cart.splice(+b.dataset.i, 1);
          renderSummary();
        })
      );
    }

    const pay = $("#pay");
    pay.disabled = state.busy || !state.cart.length;
    pay.textContent = state.busy ? "Opening payment…" : state.cart.length ? `Pay ${inr(cartTotal())}` : "Pay";

    const bar = $("#bar");
    const q = cartQty();
    bar.hidden = !q;
    bar.innerHTML = `<span>${q} ${q === 1 ? "tee" : "tees"}, <strong>${inr(cartTotal())}</strong></span><span>Check out</span>`;
  }

  function setBusy(on) {
    state.busy = on;
    renderSummary();
  }

  function formError(text, field) {
    $("#form-error").textContent = text || "";
    document.querySelectorAll("#details input").forEach((i) => i.removeAttribute("aria-invalid"));
    if (field) {
      const input = $(`#details [name="${field}"]`);
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
  }

  async function onPay(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = e.target;
    const name = f.name.value.trim();
    const phone = f.phone.value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    const email = f.email.value.trim();

    if (!state.city) {
      formError("Pick a show for pickup first.");
      $("#s1").scrollIntoView({ block: "start" });
      return;
    }
    if (!state.cart.length) return formError("Add at least one tee.");
    if (name.length < 2) return formError("Enter your name as it should appear on the pickup list.", "name");
    if (!/^[6-9]\d{9}$/.test(phone)) return formError("Enter a 10-digit Indian mobile number.", "phone");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return formError("Enter a valid email address.", "email");
    if (typeof Razorpay === "undefined") return formError("The payment window didn't load. Refresh the page and try again.");
    formError("");

    setBusy(true);
    let order;
    try {
      const res = await fetch(`${API}/api/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ city: state.city, items: state.cart, name, phone, email }),
      });
      order = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          await loadConfig().catch(() => {});
          renderDesigns();
        }
        setBusy(false);
        return formError(order.error || "Your order couldn't be created. Try again.");
      }
    } catch {
      setBusy(false);
      return formError("Couldn't reach the server. Check your connection and try again.");
    }

    const c = city(state.city);
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.rzpOrderId,
      amount: order.amount,
      currency: "INR",
      name: "Begum",
      description: `${state.cfg.tour.name} tees, ${order.code}`,
      prefill: { name: order.name, email: order.email, contact: order.phone },
      notes: { order_code: order.code, pickup: `${c.venue}, ${c.name}` },
      theme: { color: "#B03850" },
      timeout: 900,
      handler: (resp) => confirm(resp, order),
      modal: {
        ondismiss: () => {
          setBusy(false);
          formError("Payment wasn't completed, so nothing was charged. You can try again.");
        },
      },
    });
    rzp.on("payment.failed", (r) => {
      formError(`Payment failed: ${r?.error?.description || "unknown error"}. You can try again in the payment window.`);
    });
    rzp.open();
  }

  async function confirm(resp, order) {
    try {
      const res = await fetch(`${API}/api/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(resp),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      remember(data);
      showDone(data);
    } catch {
      // Payment went through at Razorpay; the webhook will still record it.
      const fallback = {
        code: order.code,
        city: city(state.city).name,
        venue: city(state.city).venue,
        email: order.email,
        items: state.cart.map((l) => ({ design: design(l.design).name, size: l.size, qty: l.qty })),
        amount: order.amount / 100,
        unconfirmed: true,
        paymentId: resp.razorpay_payment_id,
      };
      remember(fallback);
      showDone(fallback);
    }
  }

  // ── confirmation ────────────────────────────────────────────
  function showDone(o) {
    state.cart = [];
    state.busy = false;
    $("#shop").hidden = true;
    $("#bar").hidden = true;
    $("#returning").hidden = true;
    const items = o.items.map((i) => `<li>${esc(i.design)}, ${esc(i.size)} × ${i.qty}</li>`).join("");
    const note = o.unconfirmed
      ? `<p><strong>Your payment went through, but this page couldn't confirm it.</strong> Don't pay again. Keep this code and your payment ID (${esc(o.paymentId)}), and contact us if you don't get a receipt email.</p>`
      : "";
    const done = $("#done");
    done.innerHTML = `<h2>You're on the list.</h2>
      <div class="ticket">
        <p class="ticket-label">Your pickup code</p>
        <p class="code">${esc(o.code)}</p>
        ${note}
        <p>Show this code at the merch table at <strong>${esc(o.venue)}, ${esc(o.city)}</strong>${o.date ? ` on ${esc(o.date)}` : ""}. Take a screenshot so you have it handy.</p>
        <ul>${items}</ul>
        <p>Paid ${inr(o.amount)}. Razorpay sends the payment receipt to ${esc(o.email)}.</p>
      </div>
      <button type="button" class="add again">Place another order</button>`;
    done.hidden = false;
    done.querySelector(".again").addEventListener("click", () => location.reload());
    window.scrollTo({ top: 0 });
    done.focus({ preventScroll: true });
  }

  function remember(o) {
    try {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ code: o.code, city: o.city, venue: o.venue }));
    } catch {}
  }

  function showReturning() {
    let o = null;
    try {
      o = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || "null");
    } catch {}
    if (!o?.code) return;
    const el = $("#returning");
    el.innerHTML = `<p>Your last pickup code is <strong>${esc(o.code)}</strong> for ${esc(o.venue)}, ${esc(o.city)}.</p>
      <button type="button">Hide</button>`;
    el.hidden = false;
    el.querySelector("button").addEventListener("click", () => {
      el.hidden = true;
      try { localStorage.removeItem(LAST_ORDER_KEY); } catch {}
    });
  }

  init();
})();
