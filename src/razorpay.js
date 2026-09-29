export async function createRazorpayOrder(env, { amount, receipt, notes }) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Basic " + btoa(`${String(env.RAZORPAY_KEY_ID).trim()}:${String(env.RAZORPAY_KEY_SECRET).trim()}`),
    },
    body: JSON.stringify({ amount, currency: "INR", receipt, notes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay error ${res.status}`);
  return data;
}
