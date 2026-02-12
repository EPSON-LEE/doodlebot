import * as dotenv from "dotenv";

dotenv.config();

export const ARK_CONFIG = {
  apiKey: process.env.ARK_API_KEY,
  baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/coding/v3",
  model: process.env.ARK_MODEL_NAME || "doubao-seed-code",
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  dingtalkAppKey: process.env.DINGTALK_APP_KEY,
  dingtalkAppSecret: process.env.DINGTALK_APP_SECRET,
};
