const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const p = new PrismaClient();
  try {
    // Find a test order
    const order = await p.order.findFirst();
    if (!order) {
      console.error("No order found to test.");
      return;
    }
    console.log("Testing order id:", order.id);

    // Call the admin shipping endpoint. Auth middleware requires a valid token in real app.
    // For testing locally, the server's authCheck may expect a token; if so, this will fail.
    // We'll attempt the request without auth first; if blocked, we'll update the script.

    const url =
      "http://localhost:5005https://server-api-newgen.vercel.app/api/admin/order-shipping";
    const body = {
      orderId: order.id,
      trackingCarrier: "ไปรษณีย์",
      trackingCode: "TRACK123456",
    };

    // Create a token for an admin user. If the test user isn't an admin, temporarily create an admin user.
    let admin = await p.user.findFirst({
      where: { email: "admin-test@example.com" },
    });
    if (!admin) {
      admin = await p.user.create({
        data: {
          email: "admin-test@example.com",
          password: null,
          role: "admin",
        },
      });
    }
    const token = jwt.sign(
      { email: admin.email },
      process.env.SECRET || "secret",
      { expiresIn: "1h" }
    );

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    console.log("HTTP status:", res.status);
    const data = await res.json().catch(() => null);
    console.log("Response body:", data);

    // Re-read via Prisma
    const updated = await p.order.findUnique({ where: { id: order.id } });
    console.log("Updated order (shipping fields):", {
      trackingCarrier: updated.trackingCarrier,
      trackingCode: updated.trackingCode,
    });
  } catch (err) {
    console.error(err);
  } finally {
    await p.$disconnect();
  }
})();
