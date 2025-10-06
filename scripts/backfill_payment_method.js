/*
  backfill_payment_method.js
  Scans orders with stripePaymentId and null paymentMethod, retrieves Stripe PI,
  detects method (promptpay/card/cash) and updates the DB.

  Usage:
    node backfill_payment_method.js
*/

const prisma = require("../config/prisma");
const stripe = require("stripe")(
  process.env.STRIPE_SECRET || process.env.STRIPE_KEY
);

async function detect(pi) {
  if (!pi) return null;
  const hasPromptpayNextAction = !!(
    pi.next_action && pi.next_action.promptpay_display_qr_code
  );
  const pmTypes = Array.isArray(pi.payment_method_types)
    ? pi.payment_method_types.map((s) => String(s).toLowerCase())
    : [];
  const chargePmType =
    pi.charges && Array.isArray(pi.charges.data) && pi.charges.data[0]
      ? pi.charges.data[0].payment_method?.type
      : null;

  if (
    hasPromptpayNextAction ||
    pmTypes.includes("promptpay") ||
    String(chargePmType).toLowerCase() === "promptpay"
  )
    return "promptpay";
  if (pmTypes.includes("card") || String(chargePmType).toLowerCase() === "card")
    return "card";
  if (pmTypes.includes("cash") || String(chargePmType).toLowerCase() === "cash")
    return "cash";
  return null;
}

async function main() {
  console.log("Starting backfill_payment_method...");
  const orders = await prisma.order.findMany({
    where: { stripePaymentId: { not: null }, paymentMethod: null },
    select: { id: true, stripePaymentId: true },
  });
  console.log("Orders to process:", orders.length);
  for (const o of orders) {
    try {
      const pi = await stripe.paymentIntents.retrieve(o.stripePaymentId, {
        expand: ["charges.data.payment_method", "payment_method"],
      });
      const method = await detect(pi);
      if (method) {
        await prisma.order.update({
          where: { id: o.id },
          data: { paymentMethod: method },
        });
        console.log(`Order ${o.id} -> ${method}`);
      } else {
        console.log(`Order ${o.id} -> method not detected`);
      }
    } catch (err) {
      console.warn(`Order ${o.id} failed:`, err?.message || err);
    }
  }
  console.log("Backfill completed");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
