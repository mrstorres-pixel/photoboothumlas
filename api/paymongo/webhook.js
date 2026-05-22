const { allowedMethod, readRaw, sendJson } = require("../../lib/http");
const { isValidPayMongoSignature } = require("../../lib/paymongo");
const { findOrderByPaymentIntent, getOrder, updateOrder } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (!allowedMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const rawBody = await readRaw(req);

    if (!isValidPayMongoSignature(req.headers["paymongo-signature"], rawBody)) {
      return sendJson(res, 401, { error: "Invalid webhook signature." });
    }

    const event = JSON.parse(rawBody || "{}");
    await handleWebhookEvent(event);

    return sendJson(res, 200, { received: true });
  } catch (error) {
    return sendJson(res, 500, { error: "Unable to process webhook.", detail: error.message });
  }
};

async function handleWebhookEvent(event) {
  const eventType = event?.data?.attributes?.type;
  const resource = event?.data?.attributes?.data;
  const resourceAttributes = resource?.attributes || {};
  const paymentIntentId = resourceAttributes.payment_intent_id || resourceAttributes.payment_intent;
  const metadataOrderId = resourceAttributes.metadata?.order_id;
  const order = metadataOrderId
    ? await getOrder(metadataOrderId)
    : await findOrderByPaymentIntent(paymentIntentId);

  if (!order) {
    return;
  }

  if (eventType === "payment.paid") {
    await updateOrder(order.id, {
      status: "paid",
      payment_status: "paid",
      payment_id: resource?.id || "",
      paid_at: new Date().toISOString()
    });
    return;
  }

  if (eventType === "payment.failed") {
    await updateOrder(order.id, {
      status: "failed",
      payment_status: "failed"
    });
    return;
  }

  if (eventType === "qrph.expired") {
    await updateOrder(order.id, {
      status: "expired",
      payment_status: "expired"
    });
  }
}
