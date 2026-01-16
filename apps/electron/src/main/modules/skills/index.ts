/**
 * Skills Module
 * 导出Skills功能的所有公共接口
 */

export { SkillsGenerator, getSkillsGenerator } from "./skills.generator";
export {
  SkillsService,
  getSkillsService,
  type SyncResult,
  type ValidationResult,
} from "./skills.service";
export { SkillsRepository, getSkillsRepository } from "./skills.repository";
export {
  SkillsWatcher,
  getSkillsWatcher,
  resetSkillsWatcher,
  type SkillsEventType,
  type SkillsWatcherOptions,
} from "./skills.watcher";
export { setupSkillsHandlers } from "./skills.ipc";
