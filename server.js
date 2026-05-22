const fs = require("fs");
const http = require("http");
const path = require("path");
const { getEnv } = require("./lib/env");
const { sendJson } = require("./lib/http");

const env = getEnv();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

const routes = [
  {
    method: "GET",
    pattern: /^\/api\/booth\/config$/,
    handler: require("./api/booth/config")
  },
  {
    method: "POST",
    pattern: /^\/api\/orders$/,
    handler: require("./api/orders")
  },
  {
    method: "GET",
    pattern: /^\/api\/orders\/([^/]+)$/,
    handler: require("./api/orders/[id]"),
    params: ["id"]
  },
  {
    method: "POST",
    pattern: /^\/api\/orders\/([^/]+)\/layout$/,
    handler: require("./api/orders/[id]/layout"),
    params: ["id"]
  },
  {
    method: "POST",
    pattern: /^\/api\/paymongo\/webhook$/,
    handler: require("./api/paymongo/webhook")
  }
];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const route = routes.find((item) => item.method === req.method && item.pattern.test(url.pathname));

    if (route) {
      const match = url.pathname.match(route.pattern);
      req.query = Object.fromEntries(url.searchParams.entries());

      if (route.params) {
        route.params.forEach((name, index) => {
          req.query[name] = match[index + 1];
        });
      }

      return route.handler(req, res);
    }

    return serveStatic(res, url);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Server error.", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Photobooth kiosk running at http://localhost:${PORT}`);
  console.log(`Default booth: ${env.defaultBoothId}`);

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    console.log("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is empty. Using local demo data.");
  }
});

function serveStatic(res, url) {
  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml"
    }[extension] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}
