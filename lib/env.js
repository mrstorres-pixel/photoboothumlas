const fs = require("fs");
const path = require("path");

loadEnvFile();

function getEnv() {
  return {
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3000",
    defaultBoothId: process.env.BOOTH_ID || "booth-demo-001",
    paymongoWebhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET || "",
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

function getOwnerPayMongoSecret(owner) {
  if (!owner) {
    return "";
  }

  const envName = owner.paymongo_secret_env || owner.paymongoSecretKeyEnv || "PAYMONGO_SECRET_KEY";
  return process.env[envName] || "";
}

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

module.exports = {
  getEnv,
  getOwnerPayMongoSecret
};
