import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

export const webScraper: AgentTool<any> = {
  name: "web_scraper",
  label: "网页抓取",
  description: "通过浏览器访问指定 URL 并抓取网页的纯文本内容。可选支持截图功能，并可以指定截图保存路径。",
  parameters: Type.Object({
    url: Type.String({ description: "要访问的完整 URL (例如 https://baidu.com)" }),
    waitMillis: Type.Number({ description: "等待页面加载的毫秒数 (可选，默认 2000)", default: 2000 }),
    screenshot: Type.Boolean({ description: "是否捕获页面截图 (可选，默认 false)", default: false })
  }),
  execute: async (id, params) => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 }
      });
      const page = await context.newPage();
      
      // 访问网页，使用 networkidle 等待网络请求清空（更彻底的加载）
      await page.goto(params.url, { waitUntil: "networkidle", timeout: 45000 });
      
      // 执行用户自定义的额外等待（或者为了动态内容渲染的强制等待）
      const finalWait = params.waitMillis || 3000;
      await page.waitForTimeout(finalWait);

      // 提取标题和正文文本
      const title = await page.title();
      const text = await page.evaluate(() => {
        // 移除脚本、样式、广告等无关元素
        // @ts-ignore
        const clones = (document.body as any).cloneNode(true) as any;
        const toRemove = clones.querySelectorAll("script, style, nav, footer, iframe, ads");
        toRemove.forEach((el: any) => el.remove());
        return clones.innerText as string;
      });

      const cleanedText = text.replace(/\n\s*\n/g, "\n").trim().substring(0, 15000);

      // 处理截图
      let screenshotInfo = "";
      if (params.screenshot) {
        const screenshotDir = path.resolve(process.cwd(), "screenshots");
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const fileName = `screenshot_${Date.now()}.png`;
        const filePath = path.join(screenshotDir, fileName);
        await page.screenshot({ path: filePath, fullPage: true });
        screenshotInfo = `\n\n截图已保存至: screenshots/${fileName}`;
        (params as any).screenshotPath = filePath; // 传递给 details
      }

      return {
        content: [{ type: "text", text: `标题: ${title}\n\n内容概要:\n${cleanedText}${screenshotInfo}` }],
        details: { url: params.url, screenshot: params.screenshot, screenshotPath: (params as any).screenshotPath, success: true }
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `抓取失败: ${err.message}` }],
        details: { success: false },
        isError: true
      };
    } finally {
      if (browser) await browser.close();
    }
  }
};
