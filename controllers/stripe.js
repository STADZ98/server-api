const prisma = require("../config/prisma");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

exports.payment = async (req, res) => {
  try {
    //code
    console.log("test", req.user.id);
    const cart = await prisma.cart.findFirst({
      where: {
        orderedById: req.user.id,
      },
    });

    if (!cart || typeof cart.cartTotal !== "number" || cart.cartTotal <= 0) {
      console.warn("Payment creation failed: no cart or invalid cart total", {
        userId: req.user.id,
        cart,
      });
      return res
        .status(400)
        .json({ message: "ไม่พบตะกร้าสินค้าหรือยอดรวมไม่ถูกต้อง" });
    }
    const amountTHB = cart.cartTotal * 100;
    // Determine requested payment method from client (optional)
    const requestedMethod =
      req.body && typeof req.body.method === "string"
        ? String(req.body.method).toLowerCase()
        : null;

    // Recognized single-methods we support
    const singleMethods = new Set(["card", "promptpay"]);

    // Build payment_method_types: if client requested a known single method, prefer that.
    // Otherwise, enable both to let Stripe show the available options configured on the account.
    const paymentMethodTypes =
      requestedMethod && singleMethods.has(requestedMethod)
        ? [requestedMethod]
        : ["card", "promptpay"];

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountTHB,
      currency: "thb",
      payment_method_types: paymentMethodTypes,
      // automatic_payment_methods: { enabled: true }, // optional
    });

    // Debug info: print summary so operator can verify PromptPay availability
    try {
      const hasPromptpayNextAction = !!(
        paymentIntent.next_action &&
        paymentIntent.next_action.promptpay_display_qr_code
      );
      console.log("Created PI:", {
        id: paymentIntent.id,
        payment_method_types: paymentIntent.payment_method_types,
        hasPromptpayNextAction,
      });
    } catch (e) {
      // ignore logging errors
    }

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};
