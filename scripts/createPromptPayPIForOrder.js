const prisma = require("../config/prisma");
const Stripe = require("stripe");
const stripeKey = process.env.STRIPE_SECRET || process.env.STRIPE_KEY;
if (!stripeKey) {
  console.error(
    "Stripe secret key not found in environment. Set STRIPE_SECRET or STRIPE_KEY."
  );
  process.exit(1);
}
const stripe = Stripe(stripeKey);

const orderId = Number(process.argv[2]);
if (!orderId) {
  console.error("Usage: node createPromptPayPIForOrder.js <orderId>");
  process.exit(1);
}

async function run() {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      console.error("Order not found:", orderId);
      process.exit(2);
    }
    const amountTHB = Math.round((order.cartTotal || order.amount || 0) * 100);
    if (!amountTHB || amountTHB <= 0) {
      console.error("Invalid amount for order:", amountTHB);
      process.exit(3);
    }

    // console.log(
    //   "Creating PaymentIntent for order",
    //   orderId,
    //   "amount",
    //   amountTHB
    // );
    const pi = await stripe.paymentIntents.create({
      amount: amountTHB,
      currency: "thb",
      payment_method_types: ["promptpay"],
      description: `PromptPay PI for order ${orderId}`,
    });

    // console.log("Created PI:", pi.id);

    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentId: pi.id },
    });
    // console.log("Updated order", orderId, "stripePaymentId ->", pi.id);
    process.exit(0);
  } catch (e) {
    console.error(
      "Error:",
      e.response && e.response.data ? e.response.data : e.message
    );
    process.exit(4);
  }
}
run();
