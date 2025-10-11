const productController = require("./controllers/product");

function makeReq(body = {}) {
  return { body };
}

function makeRes() {
  return {
    status(code) {
      this._status = code;
      return this;
    },
    json(obj) {
      console.log(
        "RES JSON [status=" + (this._status || 200) + "]:",
        JSON.stringify(obj, null, 2)
      );
    },
  };
}

(async () => {
  try {
    const req = makeReq({ sort: "createdAt", order: "desc", limit: 2 });
    const res = makeRes();
    await productController.listby(req, res);
  } catch (err) {
    console.error("call-listby error", err && err.stack ? err.stack : err);
  }
})();
