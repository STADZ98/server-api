const express = require("express");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.options("*", (req, res) => {
  const origin = req.get("origin") || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  return res.status(204).send();
});

app.get("/api/test", (req, res) => {
  res.json({ ok: true });
});

const port = 5007;
app.listen(port, () => console.log("CORS test server listening on", port));
