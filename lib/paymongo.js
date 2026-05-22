const crypto = require("crypto");
const { getEnv } = require("./env");

async function createQrPayment(order, secretKey) {
  const env = getEnv();
  const intent = await paymongoRequest(secretKey, "/v1/payment_intents", {
    data: {
      attributes: {
        amount: order.amount,
        currency: "PHP",
        payment_method_allowed: ["qrph"],
        payment_method_options: {
          qrph: {
            expires_after: 1800
          }
        },
        description: `${order.package_name} photobooth session`,
        statement_descriptor: "PHOTOBOOTH",
        metadata: {
          order_id: order.id,
          owner_id: order.owner_id,
          booth_id: order.booth_id,
          package_id: order.package_id
        }
      }
    }
  });

  const method = await paymongoRequest(secretKey, "/v1/payment_methods", {
    data: {
      attributes: {
        type: "qrph",
        billing: {
          name: "Photobooth Customer",
          email: "customer@example.com"
        }
      }
    }
  });

  const attached = await paymongoRequest(secretKey, `/v1/payment_intents/${intent.data.id}/attach`, {
    data: {
      attributes: {
        payment_method: method.data.id,
        return_url: env.publicBaseUrl
      }
    }
  });

  const attributes = attached.data.attributes;
  const nextAction = attributes.next_action || {};
  const code = nextAction.code || {};

  return {
    payment_intent_id: attached.data.id,
    payment_method_id: method.data.id,
    payment_status: attributes.status,
    qr_image: code.image_url || "",
    test_url: nextAction.test_url || code.test_url || ""
  };
}

async function paymongoRequest(secretKey, endpoint, payload) {
  const response = await fetch(`https://api.paymongo.com${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || "PayMongo request failed.";
    throw new Error(message);
  }

  return data;
}

function isValidPayMongoSignature(header, rawBody) {
  const env = getEnv();

  if (!env.paymongoWebhookSecret) {
    return true;
  }

  const expected = crypto
    .createHmac("sha256", env.paymongoWebhookSecret)
    .update(rawBody)
    .digest("hex");

  return timingSafeIncludes(header || "", expected);
}

function timingSafeIncludes(header, expected) {
  const parts = String(header).split(",").map((part) => part.trim().split("=").at(-1));

  return parts.some((part) => {
    const received = Buffer.from(part || "", "hex");
    const target = Buffer.from(expected, "hex");
    return received.length === target.length && crypto.timingSafeEqual(received, target);
  });
}

module.exports = {
  createQrPayment,
  isValidPayMongoSignature
};
