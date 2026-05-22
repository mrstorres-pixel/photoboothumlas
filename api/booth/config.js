const { getEnv } = require("../../lib/env");
const { allowedMethod, sendJson } = require("../../lib/http");
const { getBoothConfig, publicBooth, publicPackages } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (!allowedMethod(req, res, ["GET"])) {
    return;
  }

  try {
    const env = getEnv();
    const boothId = req.query.boothId || env.defaultBoothId;
    const config = await getBoothConfig(boothId);

    if (!config) {
      return sendJson(res, 404, { error: "Booth not found or inactive." });
    }

    return sendJson(res, 200, {
      booth: publicBooth(config.booth, config.owner),
      packages: publicPackages(config.packages)
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Unable to load booth config.", detail: error.message });
  }
};
