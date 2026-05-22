const { allowedMethod, sendJson } = require("../../lib/http");
const { getBoothConfig, getOrder, publicOrder } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (!allowedMethod(req, res, ["GET"])) {
    return;
  }

  try {
    const order = await getOrder(req.query.id);

    if (!order) {
      return sendJson(res, 404, { error: "Order not found." });
    }

    const config = await getBoothConfig(order.booth_id);

    return sendJson(res, 200, { order: publicOrder(order, config) });
  } catch (error) {
    return sendJson(res, 500, { error: "Unable to load order.", detail: error.message });
  }
};
