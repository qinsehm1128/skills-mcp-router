/**
 * AI Summary Module
 * 导出AI总结功能的所有公共接口
 */

export {
  AISummaryService,
  getAISummaryService,
  resetAISummaryService,
} from "./ai-summary.service";

export { setupAISummaryHandlers } from "./ai-summary.ipc";
