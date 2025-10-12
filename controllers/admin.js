const prisma = require("../config/prisma");
let stripe = null;
if (process.env.STRIPE_SECRET) {
  try {
    stripe = require("stripe")(process.env.STRIPE_SECRET);
  } catch (e) {
    console.warn("Stripe init failed:", e && e.message ? e.message : e);
    stripe = null;
  }
} else {
  console.info(
    "Stripe not configured; STRIPE_SECRET is missing. Stripe calls will be skipped."
  );
}
const bcrypt = require("bcryptjs");

// แผนที่ภาษาไทย ↔ ENUM
const orderStatusMap = {
  รอดำเนินการ: "NOT_PROCESSED",
  กำลังดำเนินการ: "PROCESSING",
  จัดส่งแล้ว: "SHIPPED",
  จัดส่งสำเร็จ: "DELIVERED",
  ยกเลิก: "CANCELLED",
};
const reverseOrderStatusMap = Object.fromEntries(
  Object.entries(orderStatusMap).map(([k, v]) => [v, k])
);

// =======================
// ✅ อัปเดตข้อมูลผู้ใช้เร็วขึ้น
// =======================
exports.updateUserInfo = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, telephone, address, password, picture } = req.body;
    const updateData = {};
    if (email) updateData.email = email;
    if (picture) updateData.picture = picture;
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // ใช้ transaction + upsert ลด query หลายรอบ
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: updateData });

      if (name || telephone || address) {
        const existing = await tx.address.findFirst({ where: { userId: id } });
        if (existing) {
          await tx.address.update({
            where: { id: existing.id },
            data: { name, telephone, address },
          });
        } else {
          await tx.address.create({
            data: { userId: id, name, telephone, address },
          });
        }
      }
    });

    res.json({ message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("updateUserInfo error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// =======================
// ✅ เปลี่ยนสถานะคำสั่งซื้อ
// =======================
exports.changeOrderStatus = async (req, res) => {
  try {
    const { orderId, orderStatus } = req.body;

    const enumValues = [
      "NOT_PROCESSED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];
    let prismaOrderStatus = enumValues.includes(orderStatus)
      ? orderStatus
      : orderStatusMap[orderStatus?.trim()];

    if (!prismaOrderStatus)
      return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });

    const id = Number(orderId);
    if (Number.isNaN(id))
      return res.status(400).json({ message: "orderId ไม่ถูกต้อง" });

    const orderUpdate = await prisma.order.update({
      where: { id },
      data: { orderStatus: prismaOrderStatus },
    });

    res.json({
      ...orderUpdate,
      orderStatusText: reverseOrderStatusMap[orderUpdate.orderStatus],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// ✅ ดึงคำสั่งซื้อของ Admin (พร้อม pagination + ลดการเรียก Stripe)
// =======================
exports.getOrdersAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;

    console.info(`getOrdersAdmin called page=${page} perPage=${perPage}`);

    const orders = await prisma.order.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        orderedBy: { select: { id: true, email: true, picture: true } },
        address: { select: { name: true, address: true, telephone: true } },
        products: {
          include: {
            product: { include: { category: true } },
            variant: { include: {} },
          },
        },
      },
    });

    console.info(`getOrdersAdmin: fetched ${orders.length} orders from DB`);

    // Defensive mapping: if a single order has unexpected shape, log and
    // continue instead of throwing for the whole request.
    const mappedOrders = [];
    for (const order of orders) {
      try {
        const mo = {
          id: order.id,
          createdAt: order.createdAt,
          cartTotal: order.cartTotal,
          trackingCarrier: order.trackingCarrier || null,
          trackingCode: order.trackingCode || null,
          orderStatus: order.orderStatus,
          orderStatusText:
            reverseOrderStatusMap[order.orderStatus] || "ไม่ทราบสถานะ",
          stripePaymentId: order.stripePaymentId,
          amount: order.amount,
          currency: order.currency,
          orderedBy: order.orderedBy || null,
          address: order.address || null,
          name: order.address?.name || order.orderedBy?.email || null,
          products: [],
          paymentMethod: null,
        };

        if (Array.isArray(order.products)) {
          mo.products = order.products.map((p) => {
            // product.images and variant.images are stored as JSON strings or arrays
            const prodImgs =
              p.product && p.product.images
                ? Array.isArray(p.product.images)
                  ? p.product.images
                  : (() => {
                      try {
                        return JSON.parse(p.product.images);
                      } catch (e) {
                        return [];
                      }
                    })()
                : [];
            const varImgs =
              p.variant && p.variant.images
                ? Array.isArray(p.variant.images)
                  ? p.variant.images
                  : (() => {
                      try {
                        return JSON.parse(p.variant.images);
                      } catch (e) {
                        return [];
                      }
                    })()
                : [];

            const productImage =
              prodImgs && prodImgs.length
                ? prodImgs[0].url || prodImgs[0]
                : null;
            const variantImage =
              varImgs && varImgs.length ? varImgs[0].url || varImgs[0] : null;

            return {
              id: p.id,
              productId: p.productId,
              variantId: p.variantId || null,
              count: p.count,
              price: p.price,
              product: p.product
                ? {
                    id: p.product.id,
                    title: p.product.title,
                    category: p.product.category
                      ? {
                          id: p.product.category.id,
                          name: p.product.category.name,
                        }
                      : null,
                    image: productImage,
                  }
                : null,
              variant: p.variant
                ? {
                    id: p.variant.id,
                    title: p.variant.title,
                    price: p.variant.price,
                    quantity: p.variant.quantity,
                    image: variantImage,
                  }
                : null,
            };
          });
        }

        mappedOrders.push(mo);
      } catch (mapErr) {
        console.warn(
          `getOrdersAdmin: failed to map order id=${order?.id}`,
          mapErr?.message || mapErr
        );
        // push a minimal fallback so the UI can at least show an entry
        mappedOrders.push({ id: order?.id || null, error: true });
      }
    }

    // Reduce Stripe calls: retrieve PI only for orders that have stripePaymentId.
    // Run in parallel but don't allow Stripe errors to crash the request.
    await Promise.allSettled(
      mappedOrders.map(async (mo) => {
        if (!mo || !mo.stripePaymentId) return;
        if (!stripe) {
          // Stripe not configured; skip retrieving payment intent
          mo.paymentMethod = null;
          return;
        }
        try {
          const pi = await stripe.paymentIntents.retrieve(mo.stripePaymentId);
          const method = pi.payment_method_types?.[0] || null;
          if (method === "card") mo.paymentMethod = "card";
          else if (method === "promptpay" || method === "wechat_pay")
            mo.paymentMethod = "promptpay";
          else if (method === "cash") mo.paymentMethod = "cash";
        } catch (e) {
          // because stripe errors are common for old/missing PIs, include the id
          console.warn("Stripe PI error for order", mo.id, e?.message || e);
        }
      })
    );

    res.json({ page, perPage, orders: mappedOrders });
  } catch (err) {
    console.error("getOrdersAdmin error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// =======================
// ✅ Sales Summary
// =======================
exports.getSalesSummary = async (req, res) => {
  try {
    const totalSales = await prisma.order.aggregate({
      _sum: { cartTotal: true },
    });
    const totalOrders = await prisma.order.count();
    const totalUsers = await prisma.user.count();

    // Defensive: prisma mock may return unexpected shapes; guard access
    const salesSum =
      totalSales && totalSales._sum ? totalSales._sum.cartTotal : 0;
    res.json({ totalSales: salesSum || 0, totalOrders, totalUsers });
  } catch (err) {
    console.error("getSalesSummary error:", err);
    // Return err.message for local debugging; in production consider hiding details.
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =======================
// ✅ ดึงสถิติการชำระเงิน (PromptPay / Card / Cash / Unknown)
// =======================
exports.getPaymentMethodStats = async (req, res) => {
  try {
    // Defensive: perform counts in parallel and tolerate individual failures.
    // Also log Prisma connectivity for easier debugging in dev environments.
    try {
      console.info(
        "getPaymentMethodStats called - prismaConnected=",
        typeof prisma.isConnected === "function"
          ? prisma.isConnected()
          : "unknown"
      );
    } catch (e) {
      // ignore logging errors
    }

    const counts = await Promise.allSettled([
      prisma.order.count({ where: { paymentMethod: "promptpay" } }),
      prisma.order.count({ where: { paymentMethod: "card" } }),
      prisma.order.count({ where: { paymentMethod: "cash" } }),
      prisma.order.count(),
    ]);

    const [promptpayRes, cardRes, cashRes, totalRes] = counts;

    const promptpayCount =
      promptpayRes.status === "fulfilled" ? promptpayRes.value : 0;
    const cardCount = cardRes.status === "fulfilled" ? cardRes.value : 0;
    const cashCount = cashRes.status === "fulfilled" ? cashRes.value : 0;
    const total =
      totalRes.status === "fulfilled"
        ? totalRes.value
        : promptpayCount + cardCount + cashCount;

    const known = promptpayCount + cardCount + cashCount;
    const unknownCount = Math.max(0, total - known);

    const result = {
      promptpay: promptpayCount,
      card: cardCount,
      cash: cashCount,
      unknown: unknownCount,
    };

    res.json({ ok: true, stats: result });
  } catch (err) {
    console.error("getPaymentMethodStats error:", err);
    // return the error message (useful for local/dev debugging). In production
    // you may want to suppress `err.message`.
    res
      .status(500)
      .json({ ok: false, message: "Server Error", error: err.message });
  }
};

// =======================
// ✅ ลบผู้ใช้
// =======================
exports.deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.order.deleteMany({ where: { orderedById: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ message: "ลบผู้ใช้งานสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "ลบผู้ใช้งานไม่สำเร็จ" });
  }
};

// =======================
// ✅ Update user email
// =======================
exports.updateUserEmail = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email, password } = req.body;
    const data = { email };
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(password, salt);
    }
    await prisma.user.update({ where: { id }, data });
    res.json({ message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ" });
  }
};

// =======================
// ✅ Get Admin Profile
// =======================
exports.getAdminProfile = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        enabled: true,
        picture: true,
      },
    });

    const address = await prisma.address.findFirst({
      where: { userId: id },
      select: { name: true, telephone: true, address: true },
    });

    if (address?.name) user.name = address.name;

    res.json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้" });
  }
};

// =======================
// 🔧 Debug: Prisma connectivity (admin only)
// =======================
exports.debugPrisma = async (req, res) => {
  try {
    const connected =
      typeof prisma.isConnected === "function" ? prisma.isConnected() : null;
    // return a few quick counts to sanity-check data access
    const [ordersCount, usersCount] = await Promise.allSettled([
      prisma.order.count(),
      prisma.user.count(),
    ]);

    res.json({
      prismaConnected: connected,
      ordersCount:
        ordersCount.status === "fulfilled" ? ordersCount.value : null,
      usersCount: usersCount.status === "fulfilled" ? usersCount.value : null,
    });
  } catch (err) {
    console.error("debugPrisma error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// =======================
// ✅ Delete Order
// Improved: validate id, check existence, and return clearer errors
// =======================
exports.deleteOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "order id ไม่ถูกต้อง" });
    }

    // Check existence first to return a 404 if not found
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อที่ต้องการลบ" });
    }

    // perform delete of dependent records in a transaction to avoid FK issues
    // Some relations (e.g., ReturnRequest / ReturnProduct) do not specify onDelete: Cascade
    // so we explicitly remove dependent rows first.
    await prisma.$transaction(async (tx) => {
      // Delete return products attached to return requests for this order
      const returnRequests = await tx.returnRequest.findMany({
        where: { orderId },
        select: { id: true },
      });
      const returnRequestIds = returnRequests.map((r) => r.id);

      if (returnRequestIds.length > 0) {
        await tx.returnProduct.deleteMany({
          where: { returnRequestId: { in: returnRequestIds } },
        });
        await tx.returnRequest.deleteMany({
          where: { id: { in: returnRequestIds } },
        });
      }

      // Delete product-on-order rows (should cascade normally, but be explicit)
      await tx.productOnOrder.deleteMany({ where: { orderId } });

      // Finally delete the order
      await tx.order.delete({ where: { id: orderId } });
    });

    return res.json({ message: "ลบคำสั่งซื้อสำเร็จ" });
  } catch (err) {
    // Log full error for diagnostics (keeps previous behavior of hiding details from client)
    console.error("deleteOrder error:", err);

    // Prisma returns known error codes for missing records or constraint issues
    if (err && err.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อที่ต้องการลบ" });
    }

    return res.status(500).json({ message: "เกิดข้อผิดพลาดขณะลบคำสั่งซื้อ" });
  }
};

// =======================
// ✅ Update Shipping Info
// =======================
exports.updateOrderShipping = async (req, res) => {
  try {
    const { orderId, carrier, tracking, trackingCarrier, trackingCode } =
      req.body;
    // Debug log for incoming payload to help diagnose 400 errors
    console.info("updateOrderShipping called with:", {
      orderId,
      carrier,
      tracking,
      trackingCarrier,
      trackingCode,
      from: req.ip || req.headers["x-forwarded-for"] || "local",
    });
    const id = Number(orderId);
    if (Number.isNaN(id))
      return res.status(400).json({ message: "orderId ไม่ถูกต้อง" });

    const carrierValue = carrier || trackingCarrier || null;
    const trackingValue = tracking || trackingCode || null;
    console.info("Computed carrier/tracking:", { carrierValue, trackingValue });

    // Define validation regexes and examples — keep in sync with /admin/tracking-formats
    const carrierValidation = {
      "Thailand Post": {
        regex: /^[A-Z]{2}[0-9]{9}TH$/i,
        example: "EG123456789TH",
      },
      ไปรษณีย์ไทย: { regex: /^[A-Z]{2}[0-9]{9}TH$/i, example: "EG123456789TH" },
      "Flash Express": { regex: /^[0-9]{13}$/, example: "TH1234567890123" },
      Flash: { regex: /^[0-9]{13}$/, example: "TH1234567890123" },
      "J&T": { regex: /^[0-9]{12}$/, example: "820000000000" },
      "J&T Express": { regex: /^[0-9]{12}$/, example: "820000000000" },
      "Kerry Express": {
        regex: /^[A-Z]{2}[0-9]{9}$/i,
        example: "SHP123456789",
      },
      Kerry: { regex: /^[A-Z]{2}[0-9]{9}$/i, example: "SHP123456789" },
      "Ninja Van": { regex: /^[A-Z]{3}[0-9]{9}$/i, example: "NVN123456789" },
      Ninjavan: { regex: /^[A-Z]{3}[0-9]{9}$/i, example: "NVN123456789" },
      DHL: {
        regex: /(^[0-9]{10}$)|(^[A-Z][0-9]{11,14}$)/i,
        example: "1234567890",
      },
      FedEx: { regex: /^(?:[0-9]{12}|[0-9]{15})$/, example: "123456789012" },
      "SCG Express": { regex: /^SCG[0-9]{10,12}$/i, example: "SCG1234567890" },
    };

    // If a carrier was provided, ensure it's one we recognize
    if (carrierValue) {
      const found = Object.keys(carrierValidation).find(
        (k) => k.toLowerCase() === carrierValue.toString().toLowerCase()
      );
      if (!found) {
        return res.status(400).json({ message: "carrier ไม่ถูกต้อง" });
      }

      // If a tracking value was submitted, validate it
      if (trackingValue) {
        const rule = carrierValidation[found];
        if (!rule.regex.test(trackingValue.toString().trim())) {
          return res.status(400).json({
            message: "รหัสติดตามไม่ตรงรูปแบบของผู้ให้บริการ",
            example: rule.example,
          });
        }
      }
    }

    // If the DB isn't connected (dev/mock mode), return a clear 503 so the
    // client knows writes aren't possible rather than a vague 500.
    try {
      const isConnected =
        typeof prisma.isConnected === "function" ? prisma.isConnected() : true;
      if (!isConnected) {
        console.warn(
          "updateOrderShipping aborted: database not connected (mock mode)"
        );
        return res.status(503).json({
          message:
            "Database not connected: cannot update order shipping in current environment",
          code: "db_unavailable",
        });
      }
    } catch (checkErr) {
      // ignore connectivity check error and proceed to attempt update
      console.warn(
        "updateOrderShipping: prisma.isConnected check failed",
        checkErr?.message || checkErr
      );
    }

    // Perform the update and handle DB errors explicitly
    let updated;
    try {
      updated = await prisma.order.update({
        where: { id },
        data: { trackingCarrier: carrierValue, trackingCode: trackingValue },
      });
    } catch (dbErr) {
      console.error(
        "updateOrderShipping DB update failed:",
        dbErr?.message || dbErr
      );
      return res.status(503).json({
        message: "Failed to update order in database",
        code: "db_update_failed",
        error: dbErr?.message || String(dbErr),
      });
    }

    res.json({ message: "บันทึกข้อมูลการจัดส่งสำเร็จ", order: updated });
  } catch (err) {
    console.error("updateOrderShipping error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// ✅ Generate Tracking Code (server-backed sequential generator)
// =======================
exports.generateTrackingCode = async (req, res) => {
  try {
    // body: { format: 'ORD'|'INV'|'SHOP001', branch?: 'ABC' }
    const { format, branch } = req.body || {};
    if (!format) return res.status(400).json({ message: "format is required" });

    // normalize format and date
    const allowedFormats = ["ORD", "INV", "SHOP001"];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ message: "unsupported format" });
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const datePart = `${yyyy}${mm}${dd}`;

    const key =
      branch && branch.trim()
        ? `${format}:${branch.trim().toUpperCase()}:${datePart}`
        : `${format}:${datePart}`;

    // Try to increment/create a sequence row in DB. If the DB/table isn't present
    // (e.g. migrations not run or drift), fall back to a timestamp-based counter.
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
    } catch (dbErr) {
      console.warn(
        "TrackingSequence table unavailable or DB drift; using fallback counter",
        dbErr?.message || dbErr
      );
      // Fallback: derive a semi-unique counter from epoch seconds (keeps within reasonable length)
      counter = Math.floor(Date.now() / 1000) % 1000000;
    }

    // Build formatted code depending on format
    let code;
    if (format === "ORD") {
      // ORD-YYYYMMDD-000123
      const seq = String(counter).padStart(6, "0");
      code = `ORD-${datePart}-${seq}`;
    } else if (format === "INV") {
      // INV-YYYYMMDD-ABC789 (branch or random suffix)
      const suffix =
        branch && branch.trim()
          ? branch.trim().toUpperCase()
          : Math.random().toString(36).substring(2, 8).toUpperCase();
      code = `INV-${datePart}-${suffix}`;
    } else if (format === "SHOP001") {
      // SHOP001-YYYYMMDD-456 (short numeric)
      const seq = String(counter % 1000).padStart(3, "0");
      const prefix =
        branch && branch.trim() ? branch.trim().toUpperCase() : "SHOP001";
      code = `${prefix}-${datePart}-${seq}`;
    }

    return res.json({ ok: true, code, key, counter });
  } catch (err) {
    console.error("generateTrackingCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ ส่งรูปแบบเลขติดตามของผู้ให้บริการพัสดุ (สำหรับ backend consumption)
exports.getTrackingFormats = async (req, res) => {
  try {
    // Provide regex patterns and examples for common Thai carriers
    const formats = {
      "Thailand Post": {
        description: "ตัวอักษร 2 ตัว + ตัวเลข 9 หลัก + ตัวอักษร 2 ตัว (TH)",
        regex: "^[A-Z]{2}[0-9]{9}TH$",
        examples: ["EG123456789TH", "RP987654321TH"],
      },
      "Flash Express": {
        description: "ตัวเลข 13 หลัก",
        regex: "^[0-9]{13}$",
        examples: ["TH1234567890123"],
      },
      "J&T Express": {
        description: "ตัวเลข 12 หลัก",
        regex: "^[0-9]{12}$",
        examples: ["820000000000"],
      },
      "Kerry Express": {
        description: "ตัวอักษร 2 ตัว + ตัวเลข 9 หลัก",
        regex: "^[A-Z]{2}[0-9]{9}$",
        examples: ["SHP123456789"],
      },
      "Ninja Van": {
        description: "ตัวอักษร 3 ตัว + ตัวเลข 9 หลัก",
        regex: "^[A-Z]{3}[0-9]{9}$",
        examples: ["NVN123456789"],
      },
      DHL: {
        description:
          "DHL Express: ตัวเลข 10 หลัก หรือ DHL eCommerce: ตัวอักษร+ตัวเลข (12–15 หลัก)",
        regex: "(^[0-9]{10}$)|(^[A-Z][0-9]{11,14}$)",
        examples: ["1234567890", "GM123456789012345"],
      },
      FedEx: {
        description: "ตัวเลข 12 หลัก หรือ 15 หลัก",
        regex: "^(?:[0-9]{12}|[0-9]{15})$",
        examples: ["123456789012", "123456789012345"],
      },
      "SCG Express": {
        description: "ตัวอักษร SCG + ตัวเลข 10–12 หลัก",
        regex: "^SCG[0-9]{10,12}$",
        examples: ["SCG1234567890"],
      },
    };

    res.json({ ok: true, formats });
  } catch (err) {
    console.error("getTrackingFormats error:", err);
    res.status(500).json({ ok: false, message: "Server Error" });
  }
};

// =======================
// ✅ Admin: List return requests
// =======================
exports.getReturnRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;
    const where = {};
    const status = req.query.status;
    if (status) where.status = status;

    const requests = await prisma.returnRequest.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: "desc" },
      where,
      include: {
        products: { include: { product: true } },
        user: { select: { id: true, email: true, picture: true } },
        order: { select: { id: true, orderStatus: true, trackingCode: true } },
      },
    });

    // Helpers: parse images field which may be JSON string or array
    const parseImagesField = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === "string") {
        try {
          return JSON.parse(field);
        } catch (e) {
          return [];
        }
      }
      return [];
    };

    // Build absolute URL for an image entry (similar logic as product controller)
    const buildImageUrl = (img) => {
      if (!img) return null;
      const url =
        typeof img === "string"
          ? img
          : img.secure_url || img.url || img.src || null;
      if (!url) return null;
      if (/^(https?:)?\/\//i.test(url))
        return url.startsWith("http://")
          ? url.replace("http://", "https://")
          : url;
      if (/^data:/i.test(url) || /^blob:/i.test(url)) return url;
      const apiBase =
        process.env.VITE_API ||
        process.env.VITE_API_URL ||
        process.env.SERVER_URL ||
        "";
      const base = apiBase
        ? apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "")
        : "";
      if (base) return `${base}/${String(url).replace(/^\/+/, "")}`;
      if (req && req.protocol && req.get) {
        const origin = `${req.protocol}://${req.get("host")}`.replace(
          /\/$/,
          ""
        );
        return `${origin}/${String(url).replace(/^\/+/, "")}`;
      }
      return url.startsWith("/") ? url : `/${String(url).replace(/^\/+/, "")}`;
    };

    // Map requests to include parsed product image (first image) so frontend can show it easily
    const mapped = (requests || []).map((r) => {
      const mappedProducts = Array.isArray(r.products)
        ? r.products.map((p) => {
            try {
              const prod = p.product || null;
              const prodImgs =
                prod && prod.images
                  ? Array.isArray(prod.images)
                    ? prod.images
                    : (() => {
                        try {
                          return JSON.parse(prod.images);
                        } catch (e) {
                          return [];
                        }
                      })()
                  : [];

              const firstImg = prodImgs && prodImgs.length ? prodImgs[0] : null;
              const image = firstImg
                ? typeof firstImg === "string"
                  ? buildImageUrl(firstImg)
                  : buildImageUrl(firstImg)
                : null;

              return {
                id: p.id,
                productId: p.productId,
                variantId: p.variantId || null,
                product: prod
                  ? {
                      id: prod.id,
                      title: prod.title,
                      image,
                    }
                  : null,
              };
            } catch (e) {
              return { id: p.id, productId: p.productId };
            }
          })
        : [];

      return {
        ...r,
        products: mappedProducts,
      };
    });

    res.json({ ok: true, returnRequests: mapped });
  } catch (err) {
    console.error("getReturnRequests error:", err);
    res.status(500).json({ ok: false, message: "Server Error" });
  }
};

// =======================
// ✅ Admin: Update return request status (approve/reject)
// =======================
exports.updateReturnRequestStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id))
      return res.status(400).json({ message: "Invalid id" });
    const { status, adminNote } = req.body;
    const allowed = ["PENDING", "APPROVED", "REJECTED"];
    if (!status || !allowed.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    // Only update fields that exist on the ReturnRequest model in Prisma schema.
    // The Prisma schema for ReturnRequest does not define `adminNote` or `handledAt`,
    // so attempting to write them causes a Prisma error (500). Update only `status`.
    const updated = await prisma.returnRequest.update({
      where: { id },
      data: { status },
    });

    res.json({ ok: true, returnRequest: updated });
  } catch (err) {
    console.error("updateReturnRequestStatus error:", err);
    res.status(500).json({ ok: false, message: "Server Error" });
  }
};

// =======================
// ✅ Admin: List recent reviews
// =======================
exports.getReviewsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 50;
    const reviews = await prisma.review.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, picture: true } },
        images: { select: { id: true, filename: true } },
      },
    });
    res.json({ ok: true, reviews });
  } catch (err) {
    console.error("getReviewsAdmin error:", err);
    res.status(500).json({ ok: false, message: "Server Error" });
  }
};

// =======================
// ✅ Admin: Reply to a review (POST/PATCH/DELETE via admin routes)
// These mirror the functionality in reviewController but are exposed under
// the admin namespace so admin UIs can call `/api/admin/reviews/:id/reply`.
// =======================
exports.adminReplyToReview = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reply } = req.body;
    const adminId = req.user && req.user.id;

    if (isNaN(id))
      return res.status(400).json({ message: "Invalid review id" });
    if (!reply) return res.status(400).json({ message: "Reply text required" });

    const exists = await prisma.review.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Review not found" });

    const updated = await prisma.review.update({
      where: { id },
      data: { reply, replyById: Number(adminId), repliedAt: new Date() },
    });

    res.json({ ok: true, review: updated });
  } catch (err) {
    console.error("adminReplyToReview error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Server Error", error: err.message });
  }
};

exports.adminUpdateReply = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reply } = req.body;
    const adminId = req.user && req.user.id;

    if (isNaN(id))
      return res.status(400).json({ message: "Invalid review id" });
    if (!reply) return res.status(400).json({ message: "Reply text required" });

    const exists = await prisma.review.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Review not found" });

    const updated = await prisma.review.update({
      where: { id },
      data: { reply, replyById: Number(adminId), repliedAt: new Date() },
    });

    res.json({ ok: true, review: updated });
  } catch (err) {
    console.error("adminUpdateReply error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Server Error", error: err.message });
  }
};

exports.adminDeleteReply = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ message: "Invalid review id" });

    const exists = await prisma.review.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Review not found" });

    const updated = await prisma.review.update({
      where: { id },
      data: { reply: null, replyById: null, repliedAt: null },
    });

    res.json({ ok: true, review: updated });
  } catch (err) {
    console.error("adminDeleteReply error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Server Error", error: err.message });
  }
};
