function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return readRaw(req).then((raw) => (raw ? JSON.parse(raw) : {}));
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(amount / 100);
}

function allowedMethod(req, res, methods) {
  if (methods.includes(req.method)) {
    return true;
  }

  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: "Method not allowed." });
  return false;
}

module.exports = {
  allowedMethod,
  formatMoney,
  readJson,
  readRaw,
  sendJson
};
