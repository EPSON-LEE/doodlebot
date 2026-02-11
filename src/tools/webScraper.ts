import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { chromium } from "playwright";

export const webScraper: AgentTool<any> = {
  name: "web_scraper",
  label: "网页抓取",
  description: "通过浏览器访问指定 URL 并抓取网页的纯文本内容。适用于获取实时新闻、技术文档或网页资料。",
  parameters: Type.Object({
    url: Type.String({ description: "要访问的完整 URL (例如 https://example.com)" }),
    waitMillis: Type.Number({ description: "等待页面加载的毫秒数 (可选，默认 2000)", default: 2000 })
  }),
  execute: async (id, params) => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      });
      const page = await context.newPage();
      
      // 访问网页
      await page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      
      // 等待可选的延迟
      if (params.waitMillis) {
        await page.waitForTimeout(params.waitMillis);
      }

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

      const cleanedText = text.replace(/\n\s*\n/g, "\n").trim().substring(0, 15000); // 截断防止 token 溢出

      return {
        content: [{ type: "text", text: `标题: ${title}\n\n内容概要:\n${cleanedText}` }],
        details: { url: params.url, success: true }
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
