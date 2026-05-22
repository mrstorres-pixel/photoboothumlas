const { allowedMethod, readJson, sendJson } = require("../../../lib/http");
const { getOrder, uploadPrintLayout } = require("../../../lib/supabase");

module.exports = async function handler(req, res) {
  if (!allowedMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const order = await getOrder(req.query.id);

    if (!order) {
      return sendJson(res, 404, { error: "Order not found." });
    }

    const body = await readJson(req);
    const upload = await uploadPrintLayout({
      order,
      dataUrl: body.dataUrl
    });

    return sendJson(res, 200, {
      layout: upload
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Unable to save layout.", detail: error.message });
  }
};
