const crypto = require("crypto");
const { formatMoney } = require("./http");

const owner = {
  id: "owner-demo",
  business_name: "Umlas Photo Co.",
  support_email: "support@example.com",
  paymongo_secret_env: "PAYMONGO_SECRET_KEY",
  platform_fee_basis_points: 0
};

const booth = {
  id: "booth-demo-001",
  owner_id: owner.id,
  location_name: "Demo Studio",
  display_name: "Umlas Photobooth",
  activation_code: "UMLAS-DEMO-001",
  status: "active",
  theme: {
    accent: "#0f766e",
    logoText: "Umlas Photobooth"
  }
};

const packages = [
  {
    id: "classic",
    name: "Classic Strip",
    description: "4 poses, 2 printed strips",
    price: 15000,
    shots: 4,
    prints: 2
  },
  {
    id: "party",
    name: "Party Set",
    description: "6 poses, 4 printed strips",
    price: 25000,
    shots: 6,
    prints: 4
  },
  {
    id: "premium",
    name: "Premium Keepsake",
    description: "8 poses, 6 printed strips",
    price: 35000,
    shots: 8,
    prints: 6
  }
];

const orders = new Map();

async function getBoothConfig(boothId) {
  if ((boothId || booth.id) !== booth.id) {
    return null;
  }

  return {
    booth,
    owner,
    packages
  };
}

async function createOrder({ owner: orderOwner, booth: orderBooth, selectedPackage }) {
  const order = {
    id: crypto.randomUUID(),
    owner_id: orderOwner.id,
    booth_id: orderBooth.id,
    package_id: selectedPackage.id,
    package_name: selectedPackage.name,
    package_description: selectedPackage.description,
    amount: selectedPackage.price,
    shots: selectedPackage.shots,
    prints: selectedPackage.prints,
    status: "created",
    payment_status: "created",
    payment_intent_id: "",
    payment_method_id: "",
    payment_id: "",
    qr_image: "",
    test_url: "",
    created_at: new Date().toISOString()
  };

  orders.set(order.id, order);
  return order;
}

async function updateOrder(id, patch) {
  const current = orders.get(id);

  if (!current) {
    return null;
  }

  const next = { ...current, ...patch, updated_at: new Date().toISOString() };
  orders.set(id, next);
  return next;
}

async function getOrder(id) {
  return orders.get(id) || null;
}

async function findOrderByPaymentIntent(paymentIntentId) {
  return Array.from(orders.values()).find((item) => item.payment_intent_id === paymentIntentId) || null;
}

function publicBooth(rawBooth, rawOwner) {
  return {
    id: rawBooth.id,
    ownerId: rawBooth.owner_id,
    ownerName: rawOwner?.business_name || "",
    displayName: rawBooth.display_name,
    locationName: rawBooth.location_name,
    status: rawBooth.status,
    theme: rawBooth.theme || {}
  };
}

function publicPackages(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    shots: item.shots,
    prints: item.prints,
    amountLabel: formatMoney(item.price)
  }));
}

function publicOrder(order, config) {
  return {
    id: order.id,
    ownerId: order.owner_id,
    boothId: order.booth_id,
    boothName: config?.booth?.display_name || order.booth_name || "",
    locationName: config?.booth?.location_name || order.location_name || "",
    packageName: order.package_name,
    packageDescription: order.package_description,
    amountLabel: formatMoney(order.amount),
    shots: order.shots,
    prints: order.prints,
    status: order.status,
    paymentStatus: order.payment_status,
    qrImage: order.qr_image,
    testUrl: order.test_url,
    createdAt: order.created_at
  };
}

module.exports = {
  createOrder,
  findOrderByPaymentIntent,
  getBoothConfig,
  getOrder,
  publicBooth,
  publicOrder,
  publicPackages,
  updateOrder
};
