// ✅ คืนสินค้า (Return Product)
exports.returnOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { productIds, reason, customReason } = req.body;
    const userId = Number(req.user.id);

    // Validate order ownership and status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { products: true },
    });
    if (!order || order.orderedById !== userId) {
      return res
        .status(403)
        .json({ message: "ไม่พบคำสั่งซื้อหรือไม่มีสิทธิ์" });
    }
    if (order.orderStatus !== "DELIVERED") {
      return res.status(400).json({
        message: "คืนสินค้าได้เฉพาะคำสั่งซื้อที่จัดส่งสำเร็จเท่านั้น",
      });
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "กรุณาเลือกสินค้าที่ต้องการคืน" });
    }
    if (!reason || (reason === "อื่น ๆ" && !customReason)) {
      return res.status(400).json({ message: "กรุณาระบุเหตุผลในการคืนสินค้า" });
    }

    // Save return request (assume you have a ReturnRequest table)
    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        userId,
        products: { create: productIds.map((pid) => ({ productId: pid })) },
        reason,
        customReason,
        status: "PENDING",
      },
      include: { products: true },
    });

    // Optionally, mark products as returned in order (if you have such a field)
    // await prisma.productOnOrder.updateMany({
    //   where: { orderId, productId: { in: productIds } },
    //   data: { returned: true },
    // });

    res.json({ ok: true, returnRequest });
  } catch (err) {
    console.error("returnOrder error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
const prisma = require("../config/prisma");
let stripe = null;
if (process.env.STRIPE_SECRET) {
  try {
    stripe = require("stripe")(process.env.STRIPE_SECRET);
  } catch (e) {
    console.warn(
      "Stripe init failed in user controller:",
      e && e.message ? e.message : e
    );
    stripe = null;
  }
} else {
  console.info(
    "Stripe not configured; STRIPE_SECRET is missing. Stripe calls will be skipped in user controller."
  );
}


// ✅ ดึงผู้ใช้ทั้งหมด
exports.listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        enabled: true,
        picture: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          select: {
            id: true,
            address: true,
            telephone: true,
            name: true,
          },
        },
      },
    });
    res.json(users);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ เปลี่ยนสถานะผู้ใช้
exports.changeStatus = async (req, res) => {
  try {
    const { id, enabled } = req.body;
    await prisma.user.update({
      where: { id: Number(id) },
      data: { enabled },
    });
    res.send("Update Status Success");
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ เปลี่ยน Role ผู้ใช้
exports.changeRole = async (req, res) => {
  try {
    const { id, role } = req.body;
    await prisma.user.update({
      where: { id: Number(id) },
      data: { role },
    });
    res.send("Update role Success");
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ จัดการตะกร้าสินค้า
exports.userCart = async (req, res) => {
  try {
    const { cart } = req.body;
    const user = await prisma.user.findFirst({
      where: { id: Number(req.user.id) },
    });

    // Validate stock for each cart item (use variant stock when variantId present)
    for (const item of cart) {
      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: Number(item.variantId) },
          select: { quantity: true, productId: true, price: true },
        });
        if (!variant || item.count > variant.quantity) {
          return res.status(400).json({
            ok: false,
            message: `ขออภัย. สินค้า ย่อย (variant) หมดหรือจำนวนไม่เพียงพอ`,
          });
        }
      } else {
        const product = await prisma.product.findUnique({
          where: { id: item.id },
          select: { quantity: true, title: true, price: true },
        });
        if (!product || item.count > product.quantity) {
          return res.status(400).json({
            ok: false,
            message: `ขออภัย. สินค้า ${product?.title || "product"} หมด`,
          });
        }
      }
    }

    // Remove existing cart for user
    await prisma.productOnCart.deleteMany({
      where: { cart: { orderedById: user.id } },
    });
    await prisma.cart.deleteMany({ where: { orderedById: user.id } });

    // Build product items including variantId when present
    // IMPORTANT: determine authoritative price server-side (variant.price or product.price)
    const products = await Promise.all(
      cart.map(async (item) => {
        if (item.variantId) {
          const variant = await prisma.productVariant.findUnique({
            where: { id: Number(item.variantId) },
            select: { price: true, productId: true },
          });
          // fallback to parent product price when variant price is null
          let finalPrice = null;
          if (variant && typeof variant.price === "number") {
            finalPrice = variant.price;
          } else if (variant && variant.productId) {
            const parent = await prisma.product.findUnique({
              where: { id: variant.productId },
              select: { price: true },
            });
            finalPrice = parent?.price ?? 0;
          } else {
            finalPrice = 0;
          }

          return {
            productId: item.id,
            count: item.count,
            price: finalPrice,
            variantId: Number(item.variantId),
          };
        }

        // no variant
        const product = await prisma.product.findUnique({
          where: { id: item.id },
          select: { price: true },
        });
        const finalPrice = product?.price ?? 0;
        return {
          productId: item.id,
          count: item.count,
          price: finalPrice,
          variantId: null,
        };
      })
    );

    let cartTotal = products.reduce(
      (sum, item) => sum + item.price * item.count,
      0
    );

    await prisma.cart.create({
      data: {
        products: { create: products },
        cartTotal,
        orderedById: user.id,
      },
    });

    res.send("Add Cart Ok");
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ ดึงตะกร้าสินค้า
exports.getUserCart = async (req, res) => {
  try {
    const cart = await prisma.cart.findFirst({
      where: { orderedById: Number(req.user.id) },
      include: {
        products: {
          include: {
            product: { include: { category: true } },
            variant: { include: {} },
          },
        },
      },
    });

    // parse images JSON stored on product and variant rows
    const parsedProducts = (cart?.products || []).map((p) => {
      const prod = p.product || null;
      const variant = p.variant || null;
      if (prod) {
        try {
          prod.images = Array.isArray(prod.images)
            ? prod.images
            : prod.images
            ? JSON.parse(prod.images)
            : [];
        } catch (e) {
          prod.images = [];
        }
      }
      if (variant) {
        try {
          variant.images = Array.isArray(variant.images)
            ? variant.images
            : variant.images
            ? JSON.parse(variant.images)
            : [];
        } catch (e) {
          variant.images = [];
        }
      }
      return { ...p, product: prod, variant };
    });

    res.json({ products: parsedProducts, cartTotal: cart?.cartTotal || 0 });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ ล้างตะกร้าสินค้า
exports.emptyCart = async (req, res) => {
  try {
    const cart = await prisma.cart.findFirst({
      where: { orderedById: Number(req.user.id) },
    });

    if (!cart) {
      return res.status(400).json({ message: "No Cart" });
    }

    await prisma.productOnCart.deleteMany({ where: { cartId: cart.id } });
    const result = await prisma.cart.deleteMany({
      where: { orderedById: Number(req.user.id) },
    });

    res.json({ message: "Cart Empty Success", deletedCount: result.count });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ บันทึกที่อยู่ใหม่
exports.saveAddress = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { address, telephone, name } = req.body;

    const newAddress = await prisma.address.create({
      data: {
        address,
        telephone,
        name,
        userId: Number(req.user.id),
      },
    });

    res.json({ message: "บันทึกที่อยู่สำเร็จ", address: newAddress });
  } catch (err) {
    console.error("❌ saveAddress error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ อัปเดตที่อยู่
exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { address, telephone, name } = req.body;

    // ตรวจสอบว่ามี address นี้หรือไม่
    const exist = await prisma.address.findUnique({
      where: { id: Number(id) },
    });
    if (!exist) {
      return res.status(404).json({ message: "ไม่พบที่อยู่ที่ต้องการอัปเดต" });
    }

    const updated = await prisma.address.update({
      where: { id: Number(id) },
      data: { address, telephone, name },
    });

    res.json({ message: "อัปเดตที่อยู่สำเร็จ", address: updated });
  } catch (err) {
    console.log("❌ updateAddress error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ ลบที่อยู่
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.address.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "ลบที่อยู่สำเร็จ" });
  } catch (err) {
    console.log("❌ deleteAddress error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ ดึงที่อยู่ของผู้ใช้
exports.getUserAddress = async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: Number(req.user.id) },
      select: { id: true, address: true, telephone: true, name: true },
    });

    res.json({ addresses });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ บันทึกคำสั่งซื้อ
exports.saveOrder = async (req, res) => {
  try {
    const {
      id,
      amount,
      status,
      currency,
      address,
      telephone,
      name,
      addressId,
    } = req.body.paymentIntent;
    const userId = Number(req.user.id);

    // ตรวจสอบข้อมูลที่อยู่
    if ((!addressId && (!address || !telephone || !name)) || !userId) {
      return res.status(400).json({ message: "ข้อมูลที่อยู่ไม่ครบถ้วน" });
    }

    function mapStripeStatusToPrisma(status) {
      if (status === "succeeded") return "PAID";
      if (status === "pending") return "PENDING";
      if (status === "failed") return "FAILED";
      return "PENDING";
    }

    const prismaStatus = mapStripeStatusToPrisma(status);

    const userCart = await prisma.cart.findFirst({
      where: { orderedById: userId },
      include: { products: true },
    });

    if (!userCart) {
      return res.status(400).json({ message: "ไม่พบตะกร้าสินค้า" });
    }

    let usedAddressId = addressId;
    // ถ้าไม่มี addressId ให้สร้างใหม่
    if (!usedAddressId) {
      const addressRecord = await prisma.address.create({
        data: {
          address,
          telephone,
          name,
          userId,
        },
      });
      usedAddressId = addressRecord.id;
    }

    const order = await prisma.order.create({
      data: {
        products: {
          create: userCart.products.map((item) => ({
            productId: item.productId,
            count: item.count,
            price: item.price,
            variantId: item.variantId ? Number(item.variantId) : null,
          })),
        },
        orderedBy: { connect: { id: userId } },
        cartTotal: userCart.cartTotal,
        stripePaymentId: id,
        amount: Math.round(amount / 100), // แปลงเป็นจำนวนเต็ม
        status: prismaStatus,
        currency,
        address: { connect: { id: usedAddressId } },
      },
      include: {
        products: {
          include: {
            product: { include: { category: true } },
            variant: { include: {} },
          },
        },
        address: true,
      },
    });

    // Generate a professional tracking code automatically for the new order.
    // Uses the same TrackingSequence model as admin.generateTrackingCode
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const datePart = `${yyyy}${mm}${dd}`;
      const key = `ORD:${datePart}`;

      let counter;
      try {
        const result = await prisma.$transaction(async (tx) => {
          const existing = await tx.trackingSequence.findUnique({
            where: { key },
          });
          if (existing) {
            const updated = await tx.trackingSequence.update({
              where: { key },
              data: { counter: { increment: 1 } },
            });
            return updated;
          }
          const created = await tx.trackingSequence.create({
            data: { key, counter: 1 },
          });
          return created;
        });
        counter = result.counter;
      } catch (seqErr) {
        // Fallback to time-based counter if table missing
        counter = Math.floor(Date.now() / 1000) % 1000000;
      }

      const seq = String(counter).padStart(6, "0");
      const trackingCode = `ORD-${datePart}-${seq}`;

      // Attach tracking code to order
      await prisma.order.update({
        where: { id: order.id },
        data: { trackingCode },
      });
      // reflect back to returned object for immediate use
      order.trackingCode = trackingCode;
    } catch (err) {
      console.warn(
        "Failed to auto-generate tracking code for order",
        order.id,
        err?.message || err
      );
    }

    // Attempt to detect and persist payment method from Stripe PI if available
    try {
      if (order.stripePaymentId) {
        const pi = await stripe.paymentIntents.retrieve(order.stripePaymentId, {
          expand: ["charges.data.payment_method", "payment_method"],
        });

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

        let detected = null;
        if (
          hasPromptpayNextAction ||
          pmTypes.includes("promptpay") ||
          String(chargePmType).toLowerCase() === "promptpay"
        ) {
          detected = "promptpay";
        } else if (
          pmTypes.includes("card") ||
          String(chargePmType).toLowerCase() === "card"
        ) {
          detected = "card";
        } else if (
          pmTypes.includes("cash") ||
          String(chargePmType).toLowerCase() === "cash"
        ) {
          detected = "cash";
        }

        if (detected) {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentMethod: detected },
          });
          order.paymentMethod = detected;
        }
      }
    } catch (err) {
      console.warn(
        "Failed to persist paymentMethod for order",
        order.id,
        err?.message || err
      );
    }

    // console.log("Order created:", { orderId: order.id, userId });

    // Update stock: decrement variant quantity if variantId present, else decrement product
    const updatePromises = userCart.products.map((item) => {
      if (item.variantId) {
        return prisma.productVariant.update({
          where: { id: Number(item.variantId) },
          data: {
            quantity: { decrement: item.count },
            sold: { increment: item.count },
          },
        });
      }
      return prisma.product.update({
        where: { id: item.productId },
        data: {
          quantity: { decrement: item.count },
          sold: { increment: item.count },
        },
      });
    });
    await Promise.all(updatePromises);

    await prisma.cart.deleteMany({
      where: { orderedById: userId },
    });

    res.json({ ok: true, order });
  } catch (err) {
    console.error("saveOrder error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ ดึงคำสั่งซื้อของผู้ใช้
exports.getOrder = async (req, res) => {
  try {
    console.log(
      "getOrder called by user:",
      req.user?.email || "unknown",
      "id:",
      req.user?.id
    );

    const userId = Number(req.user.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, message: "Invalid user id" });
    }

    const orders = await prisma.order.findMany({
      where: { orderedById: userId },
      include: {
        products: {
          include: {
            product: { include: { category: true } },
            variant: { include: {} },
          },
        },
        address: true,
        orderedBy: true,
        ReturnRequest: {
          include: {
            products: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to plain serializable structure used by frontend
    const mapped = Array.isArray(orders)
      ? orders.map((o) => ({
          id: o.id,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          cartTotal: o.cartTotal,
          orderStatus: o.orderStatus,
          stripePaymentId: o.stripePaymentId,
          amount: o.amount,
          currency: o.currency,
          address: o.address
            ? {
                id: o.address.id,
                name: o.address.name || null,
                address: o.address.address || null,
                telephone: o.address.telephone || null,
              }
            : null,
          orderedBy: o.orderedBy
            ? {
                id: o.orderedBy.id,
                name: o.orderedBy.name || null,
                email: o.orderedBy.email,
              }
            : null,
          // convenience top-level fields
          name: o.address?.name || o.orderedBy?.name || null,
          email: o.orderedBy?.email || null,
          products: Array.isArray(o.products)
            ? o.products.map((p) => {
                const prod = p.product || null;
                const variant = p.variant || null;
                let prodImgs = [];
                let varImgs = [];
                if (prod) {
                  try {
                    prodImgs = Array.isArray(prod.images)
                      ? prod.images
                      : prod.images
                      ? JSON.parse(prod.images)
                      : [];
                  } catch (e) {
                    prodImgs = [];
                  }
                }
                if (variant) {
                  try {
                    varImgs = Array.isArray(variant.images)
                      ? variant.images
                      : variant.images
                      ? JSON.parse(variant.images)
                      : [];
                  } catch (e) {
                    varImgs = [];
                  }
                }

                return {
                  id: p.id,
                  productId: p.productId,
                  variantId: p.variantId || null,
                  count: p.count,
                  price: p.price,
                  product: prod
                    ? {
                        id: prod.id,
                        title: prod.title,
                        category: prod.category
                          ? { id: prod.category.id, name: prod.category.name }
                          : null,
                        image:
                          prodImgs && prodImgs.length
                            ? prodImgs[0].url || prodImgs[0]
                            : null,
                      }
                    : null,
                  variant: variant
                    ? {
                        id: variant.id,
                        title: variant.title,
                        price: variant.price,
                        quantity: variant.quantity,
                        image:
                          varImgs && varImgs.length
                            ? varImgs[0].url || varImgs[0]
                            : null,
                      }
                    : null,
                };
              })
            : [],
          // include shipping/tracking fields so frontend can render them
          trackingCarrier: o.trackingCarrier || null,
          trackingCode: o.trackingCode || null,
          shippingFee: o.shippingFee || 0,
        }))
      : [];

    // Enrich mapped orders with payment method when stripePaymentId exists
    await Promise.allSettled(
      mapped.map(async (mo) => {
        if (!mo.stripePaymentId) return;
        try {
          const pi = await stripe.paymentIntents.retrieve(mo.stripePaymentId, {
            expand: ["charges.data.payment_method", "payment_method"],
          });

          // Prefer explicit signals: next_action promptpay QR or payment_method type on charge
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

          // Normalize detection
          if (
            hasPromptpayNextAction ||
            pmTypes.includes("promptpay") ||
            String(chargePmType).toLowerCase() === "promptpay"
          ) {
            mo.paymentMethod = "promptpay";
          } else if (
            pmTypes.includes("card") ||
            String(chargePmType).toLowerCase() === "card"
          ) {
            mo.paymentMethod = "card";
          } else if (
            pmTypes.includes("cash") ||
            String(chargePmType).toLowerCase() === "cash"
          ) {
            mo.paymentMethod = "cash";
          }
        } catch (e) {
          console.warn(
            "Stripe PI error for user order",
            mo.id,
            e?.message || e
          );
        }
      })
    );

    return res.json({ ok: true, orders: mapped });
  } catch (err) {
    console.error("getOrder error:", err);
    res
      .status(500)
      .json({ message: "Server Error", error: err.message || String(err) });
  }
};

// GET /user/order/:id/payment-method
// Returns a JSON with detected paymentMethod for the order (does not modify DB)
exports.getOrderPaymentMethod = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const userId = Number(req.user?.id);
    if (!orderId || !userId)
      return res.status(400).json({ ok: false, message: "Invalid parameters" });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.orderedById !== userId) {
      return res
        .status(403)
        .json({ ok: false, message: "Not found or unauthorized" });
    }

    if (!order.stripePaymentId) {
      return res.json({
        ok: true,
        paymentMethod: null,
        reason: "no_stripePaymentId",
      });
    }

    try {
      console.log(
        `getOrderPaymentMethod: lookup orderId=${orderId} userId=${userId} stripePaymentId=${order.stripePaymentId}`
      );
      const pi = await stripe.paymentIntents.retrieve(order.stripePaymentId, {
        expand: ["charges.data.payment_method", "payment_method"],
      });

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

      let detected = null;
      if (
        hasPromptpayNextAction ||
        pmTypes.includes("promptpay") ||
        String(chargePmType).toLowerCase() === "promptpay"
      ) {
        detected = "promptpay";
      } else if (
        pmTypes.includes("card") ||
        String(chargePmType).toLowerCase() === "card"
      ) {
        detected = "card";
      } else if (
        pmTypes.includes("cash") ||
        String(chargePmType).toLowerCase() === "cash"
      ) {
        detected = "cash";
      }

      return res.json({
        ok: true,
        paymentMethod: detected,
        raw: {
          payment_method_types: pi.payment_method_types || null,
          next_action: pi.next_action || null,
          chargePaymentMethodType: chargePmType || null,
        },
      });
    } catch (err) {
      // Log full error for debugging (in dev). The error message is also returned
      // to the caller to help troubleshooting in development environments.
      console.error("Error retrieving PI for order", orderId, err);
      const emsg =
        err?.message || (err && err.toString()) || "Unknown Stripe error";
      return res.status(500).json({
        ok: false,
        message: "Stripe retrieval failed",
        error: emsg,
      });
    }
  } catch (err) {
    console.error("getOrderPaymentMethod error:", err);
    return res.status(500).json({ ok: false, message: "Server Error" });
  }
};

// ✅ ยกเลิกคำสั่งซื้อ
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order || order.orderedById !== Number(req.user.id)) {
      return res
        .status(403)
        .json({ message: "ไม่พบคำสั่งซื้อหรือไม่มีสิทธิ์" });
    }

    function mapOrderStatus(input) {
      const valid = [
        "NotProcess",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ];
      const map = {
        completed: "Delivered",
        complete: "Delivered",
        success: "Delivered",
        cancel: "Cancelled",
        cancelled: "Cancelled",
        processing: "Processing",
        shipped: "Shipped",
        pending: "NotProcess",
      };
      return map[input?.toLowerCase()] || "Cancelled";
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: "CANCELLED" },
    });

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ อัปโหลดรูปโปรไฟล์ และเก็บ url ใน user.picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    // ต้องมี user ที่ล็อกอินอยู่
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let targetUserId = Number(req.user.id);
    const { userId } = req.body;

    // ถ้าเป็น admin และส่ง userId มาก็ให้เปลี่ยนเป้าหมายได้
    if (userId && req.user.role === "admin") {
      targetUserId = Number(userId);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let base64Image = null;

    // ✅ กรณีส่งเป็นไฟล์ (multipart/form-data)
    if (req.file && req.file.buffer) {
      base64Image = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;
    }

    // ✅ กรณีส่งมาเป็น base64 ผ่าน JSON body
    else if (req.body.image && typeof req.body.image === "string") {
      base64Image = req.body.image;
    }

    if (!base64Image) {
      return res.status(400).json({ message: "No image provided" });
    }

    // ✅ อัปเดตลงในฐานข้อมูล (เก็บเป็น base64 string)
    await prisma.user.update({
      where: { id: targetUserId },
      data: { picture: base64Image },
    });

    res.json({
      message: "Profile picture updated successfully",
      userId: targetUserId,
    });
  } catch (err) {
    console.error("uploadProfilePicture error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
