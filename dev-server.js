const app = require("./server");
const port = process.env.PORT || 5005;

app.listen(port, () => {
  console.log(`Dev server listening on http://localhost:${port}`);
});
