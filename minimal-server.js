require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
console.log("creating app");
app.use(cors({ origin: true, credentials: true }));
console.log("applied cors");
app.options("*", cors({ origin: true, credentials: true }));
console.log("applied options");
app.use((req, res, next) => {
  res.status(200).send("ok");
});
app.listen(5006, () => console.log("listening"));
