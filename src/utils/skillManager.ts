import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

export interface Skill {
  name: string;
  description: string;
  path: string;
}

export const skillManager = {
  /**
   * 发现技能：查找 .pi/skills/ 目录下的 SKILL.md 文件
   */
  discoverSkills(): Skill[] {
    const skillsDir = path.resolve(process.cwd(), ".pi/skills");
    if (!fs.existsSync(skillsDir)) return [];

    const skills: Skill[] = [];
    const items = fs.readdirSync(skillsDir);

    for (const item of items) {
      const skillPath = path.join(skillsDir, item);
      if (fs.statSync(skillPath).isDirectory()) {
        const skillFile = path.join(skillPath, "SKILL.md");
        if (fs.existsSync(skillFile)) {
          const content = fs.readFileSync(skillFile, "utf-8");
          const skill = this.parseSkillMarkdown(content, skillFile);
          if (skill) skills.push(skill);
        }
      } else if (item.endsWith(".md")) {
         const content = fs.readFileSync(skillPath, "utf-8");
         const skill = this.parseSkillMarkdown(content, skillPath);
         if (skill) skills.push(skill);
      }
    }
    return skills;
  },

  /**
   * 解析 Skill Markdown 的元数据
   */
  parseSkillMarkdown(content: string, filePath: string): Skill | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;

    try {
      const yamlContent = match[1] as string;
      const frontmatter = yaml.load(yamlContent) as any;
      if (frontmatter && frontmatter.name && frontmatter.description) {
        return {
          name: frontmatter.name,
          description: frontmatter.description,
          path: filePath,
        };
      }
    } catch (e) {
      console.error(`解析 Skill 失败 (${filePath}):`, e);
    }
    return null;
  },

  /**
   * 读取完整的技能内容
   */
  getSkillContent(skillName: string): string | null {
    const skills = this.discoverSkills();
    const skill = skills.find(s => s.name === skillName);
    if (!skill) return null;
    return fs.readFileSync(skill.path, "utf-8");
  }
};
