const { allowedMethod, sendJson } = require("../../lib/http");
const { getOwnerPayMongoSecret } = require("../../lib/env");
const { retrievePaymentIntent } = require("../../lib/paymongo");
const { getBoothConfig, getOrder, publicOrder, updateOrder } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (!allowedMethod(req, res, ["GET"])) {
    return;
  }

  try {
    let order = await getOrder(req.query.id);

    if (!order) {
      return sendJson(res, 404, { error: "Order not found." });
    }

    const config = await getBoothConfig(order.booth_id);
    order = await refreshPaymentStatus(order, config);

    return sendJson(res, 200, { order: publicOrder(order, config) });
  } catch (error) {
    return sendJson(res, 500, { error: "Unable to load order.", detail: error.message });
  }
};

async function refreshPaymentStatus(order, config) {
  if (!order.payment_intent_id || order.status === "paid" || order.status === "failed" || order.status === "expired") {
    return order;
  }

  const secretKey = getOwnerPayMongoSecret(config?.owner);

  if (!secretKey) {
    return order;
  }

  const intent = await retrievePaymentIntent(secretKey, order.payment_intent_id);
  const attributes = intent.data?.attributes || {};

  if (attributes.status === "succeeded") {
    const payment = Array.isArray(attributes.payments) ? attributes.payments[0] : null;

    return updateOrder(order.id, {
      status: "paid",
      payment_status: "paid",
      payment_id: payment?.id || order.payment_id || "",
      paid_at: new Date().toISOString()
    });
  }

  if (attributes.status && attributes.status !== order.payment_status) {
    return updateOrder(order.id, {
      payment_status: attributes.status
    });
  }

  return order;
}
