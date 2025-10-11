(async () => {
  try {
    const res = await fetch("http://127.0.0.1:5005/api/productby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort: "createdAt", order: "desc", limit: 2 }),
    });
    const data = await res.json();
    console.log("status", res.status);
    console.log("data", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("request error", err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
