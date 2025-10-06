let fetch = global.fetch;
if (!fetch) {
  try {
    fetch = require("node-fetch");
  } catch (e) {
    /* will error later if fetch missing */
  }
}

async function testTrack(serverUrl, carrier, tracking) {
  const url = `${serverUrl.replace(
    /\/$/,
    ""
  )}https://server-api-newgen.vercel.app/api/shipping/track`;
  console.log("POST", url, { carrier, tracking });
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier, tracking }),
    });
    const data = await resp.json();
    console.log("Status:", resp.status);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Request failed:", err.message);
  }
}

if (require.main === module) {
  const server = process.argv[2] || "http://localhost:5005";
  const carrier = process.argv[3] || "Flash";
  const tracking = process.argv[4] || "TRACK12345";
  testTrack(server, carrier, tracking);
}
