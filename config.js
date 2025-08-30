const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  API_BASE_URL: process.env.API_BASE_URL || "https://generativelanguage.googleapis.com/v1",
  MODEL_NAME: process.env.MODEL_NAME || "gemini-2.0-flash",
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
  SERPER_API_URL: "https://google.serper.dev/search",
  SERPER_API_KEY: process.env.SERPER_API_KEY
};

module.exports = config;
