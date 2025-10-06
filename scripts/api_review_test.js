require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

(async () => {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: "test@example.com" },
    });
    if (!user) {
      console.error("Test user not found");
      process.exit(1);
    }
    const payload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.SECRET || "PetShopOnline", {
      expiresIn: "7d",
    });

    const productId = 48;
    const variantId = 5;
    const orderId = 12; // the order we created earlier

    // use native fetch if available
    const doFetch = async (url, opts) => {
      if (typeof fetch === "function") return fetch(url, opts);
      // try to require node-fetch fallback
      try {
        const nodeFetch = require("node-fetch");
        return nodeFetch(url, opts);
      } catch (e) {
        console.error("No fetch available and node-fetch not installed");
        process.exit(1);
      }
    };

    console.log("Using token for user id", user.id);

    // POST review
    const postRes = await doFetch(
      "http://localhost:5005https://server-api-newgen.vercel.app/api/review",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          productId,
          variantId,
          orderId,
          rating: 5,
          comment: "Automated API test review",
        }),
      }
    );
    const postJson = await postRes.json();
    console.log("POST status", postRes.status);
    console.log("POST response", JSON.stringify(postJson, null, 2));

    // GET order-scoped
    const getOrderRes = await doFetch(
      `http://localhost:5005https://server-api-newgen.vercel.app/api/review/${productId}?orderId=${orderId}`
    );
    const getOrderJson = await getOrderRes.json();
    console.log("GET order-scoped status", getOrderRes.status);
    console.log(
      "GET order-scoped response",
      JSON.stringify(getOrderJson, null, 2)
    );

    // GET all
    const getAllRes = await doFetch(
      `http://localhost:5005https://server-api-newgen.vercel.app/api/review/${productId}`
    );
    const getAllJson = await getAllRes.json();
    console.log("GET all status", getAllRes.status);
    console.log("GET all response", JSON.stringify(getAllJson, null, 2));
  } catch (e) {
    console.error("Error in test script", e);
  } finally {
    await prisma.$disconnect();
  }
})();
