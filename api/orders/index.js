const { getOwnerPayMongoSecret } = require("../../lib/env");
const { allowedMethod, readJson, sendJson } = require("../../lib/http");
const { createQrPayment } = require("../../lib/paymongo");
const {
  createOrder,
  getBoothConfig,
  publicOrder,
  updateOrder
} = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (!allowedMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJson(req);
    const config = await getBoothConfig(body.boothId);

    if (!config) {
      return sendJson(res, 404, { error: "Booth not found or inactive." });
    }

    const selectedPackage = config.packages.find((item) => item.id === body.packageId);

    if (!selectedPackage) {
      return sendJson(res, 400, { error: "Unknown package selected for this booth." });
    }

    let order = await createOrder({
      owner: config.owner,
      booth: config.booth,
      selectedPackage
    });
    const paymongoSecretKey = getOwnerPayMongoSecret(config.owner);

    if (!paymongoSecretKey) {
      order = await updateOrder(order.id, {
        status: "paid",
        payment_status: "demo_paid"
      });

      return sendJson(res, 201, {
        order: publicOrder(order, config),
        demoMode: true,
        message: "No PayMongo key is configured for this owner. Demo mode marked this order as paid."
      });
    }

    const payment = await createQrPayment(order, paymongoSecretKey);
    order = await updateOrder(order.id, {
      ...payment,
      status: "awaiting_payment"
    });

    return sendJson(res, 201, {
      order: publicOrder(order, config),
      demoMode: false
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Unable to create order.", detail: error.message });
  }
};
