import { calculateArea } from "./calculateArea.js";
import { executeCommand } from "./executeCommand.js";
import { manageFiles } from "./manageFiles.js";
import { readSkill } from "./readSkill.js";
import { webScraper } from "./webScraper.js";

export const agentTools = [
  calculateArea,
  executeCommand,
  manageFiles,
  readSkill,
  webScraper,
];
