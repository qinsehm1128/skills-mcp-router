import { ipcMain, app } from "electron";
import { commandExists } from "@/main/utils/env-utils";

let isAutoUpdateInProgress = false;

export function setupSystemHandlers(): void {
  // System info and commands
  ipcMain.handle("system:getPlatform", () => {
    return process.platform;
  });

  // Check if a command exists in user shell environment
  ipcMain.handle("system:commandExists", async (_, command: string) => {
    const result = await commandExists(command);
    return result;
  });

  // Update management (disabled)
  ipcMain.handle("system:checkForUpdates", () => {
    return {
      updateAvailable: false,
    };
  });

  ipcMain.handle("system:installUpdate", () => {
    return false;
  });

  // Application restart
  ipcMain.handle("system:restartApp", () => {
    app.quit();
    return true;
  });
}

export function getIsAutoUpdateInProgress(): boolean {
  return isAutoUpdateInProgress;
}
