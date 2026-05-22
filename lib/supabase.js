const { getEnv } = require("./env");
const fallbackStore = require("./seed");

function hasSupabase() {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

async function supabaseRequest(path, options = {}) {
  const env = getEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || "Supabase request failed.");
  }

  return data;
}

async function getBoothConfig(boothId) {
  if (!hasSupabase()) {
    return fallbackStore.getBoothConfig(boothId);
  }

  const booths = await supabaseRequest(
    `booths?id=eq.${encodeURIComponent(boothId)}&status=eq.active&select=*`,
    { method: "GET" }
  );

  const booth = booths[0];

  if (!booth) {
    return null;
  }

  const owners = await supabaseRequest(
    `owners?id=eq.${encodeURIComponent(booth.owner_id)}&select=*`,
    { method: "GET" }
  );
  const boothPackages = await supabaseRequest(
    `booth_packages?booth_id=eq.${encodeURIComponent(booth.id)}&select=package_id,sort_order`,
    { method: "GET" }
  );
  const ids = boothPackages.map((item) => item.package_id);
  const packages = ids.length
    ? await supabaseRequest(`packages?id=in.(${ids.map(encodeURIComponent).join(",")})&select=*`, { method: "GET" })
    : [];

  const sortIndex = new Map(boothPackages.map((item) => [item.package_id, item.sort_order]));
  packages.sort((a, b) => (sortIndex.get(a.id) || 0) - (sortIndex.get(b.id) || 0));

  return {
    booth,
    owner: owners[0] || null,
    packages
  };
}

async function createOrder({ owner, booth, selectedPackage }) {
  if (!hasSupabase()) {
    return fallbackStore.createOrder({ owner, booth, selectedPackage });
  }

  const rows = await supabaseRequest("orders", {
    method: "POST",
    body: JSON.stringify({
      owner_id: owner.id,
      booth_id: booth.id,
      package_id: selectedPackage.id,
      package_name: selectedPackage.name,
      package_description: selectedPackage.description,
      amount: selectedPackage.price,
      shots: selectedPackage.shots,
      prints: selectedPackage.prints,
      status: "created",
      payment_status: "created"
    })
  });

  return rows[0];
}

async function updateOrder(id, patch) {
  if (!hasSupabase()) {
    return fallbackStore.updateOrder(id, patch);
  }

  const rows = await supabaseRequest(`orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });

  return rows[0] || null;
}

async function getOrder(id) {
  if (!hasSupabase()) {
    return fallbackStore.getOrder(id);
  }

  const rows = await supabaseRequest(`orders?id=eq.${encodeURIComponent(id)}&select=*`, { method: "GET" });
  return rows[0] || null;
}

async function findOrderByPaymentIntent(paymentIntentId) {
  if (!hasSupabase()) {
    return fallbackStore.findOrderByPaymentIntent(paymentIntentId);
  }

  const rows = await supabaseRequest(
    `orders?payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=*`,
    { method: "GET" }
  );
  return rows[0] || null;
}

module.exports = {
  createOrder,
  findOrderByPaymentIntent,
  getBoothConfig,
  getOrder,
  hasSupabase,
  publicBooth: fallbackStore.publicBooth,
  publicOrder: fallbackStore.publicOrder,
  publicPackages: fallbackStore.publicPackages,
  updateOrder
};
