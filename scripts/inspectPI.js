const Stripe = require("stripe");
const stripeKey = process.env.STRIPE_SECRET || process.env.STRIPE_KEY;
if (!stripeKey) {
  console.error(
    "Stripe secret key not found in environment. Set STRIPE_SECRET or STRIPE_KEY."
  );
  process.exit(1);
}
const stripe = Stripe(stripeKey);
const id = process.argv[2];
if (!id) {
  console.error("Usage: node inspectPI.js <pi_id>");
  process.exit(1);
}
(async () => {
  try {
    const pi = await stripe.paymentIntents.retrieve(id, {
      expand: ["charges.data.payment_method", "payment_method"],
    });
    // console.log(JSON.stringify(pi, null, 2));
  } catch (e) {
    console.error("Error:", e.message, e.response && e.response.data);
  }
})();
