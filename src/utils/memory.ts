import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import * as path from "path";
import { logger } from "./logger.js";

const MEMORY_FILE = path.resolve(process.cwd(), "agent_memory.json");

export const memoryManager = {
  save(messages: any[]) {
    try {
      writeFileSync(MEMORY_FILE, JSON.stringify(messages, null, 2));
    } catch (e: any) {
      logger.error(`保存记忆失败: ${e.message}`);
    }
  },
  load(): any[] {
    try {
      if (existsSync(MEMORY_FILE)) {
        const data = readFileSync(MEMORY_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch {}
    return [];
  },
  clear() {
    try {
      if (existsSync(MEMORY_FILE)) {
        unlinkSync(MEMORY_FILE);
      }
      logger.info("已清空持久化记忆。");
    } catch {
      logger.info("记忆文件不存在或已清空。");
    }
  }
};
