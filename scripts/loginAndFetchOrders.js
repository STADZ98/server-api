async function run() {
  try {
    const API_BASE =
      process.env.API_BASE ||
      process.env.VITE_API ||
      "http://localhost:5005https://server-api-newgen.vercel.app/api";
    const loginRes = await fetch(`${API_BASE.replace(/\/+$/, "")}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "testadmin@example.com",
        password: "Admin123!",
      }),
    });
    const login = await loginRes.json();
    // console.log("login response keys:", Object.keys(login));
    const token = login.token;
    if (!token) {
      console.error("No token in login response", login);
      return;
    }
    // console.log("token:", token.substring(0, 40) + "...");
    const ordersRes = await fetch(
      `${API_BASE.replace(/\/+$/, "")}/admin/orders`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const orders = await ordersRes.json();
    // console.log(
    //   "orders count:",
    //   Array.isArray(orders) ? orders.length : "not-array"
    // );
    // console.log(JSON.stringify((orders || []).slice(0, 2), null, 2));
  } catch (e) {
    console.error("Error:", e.message || e);
  }
}
run();
