// src/internal/cmdFunctions/tempLogs.ts
import path from "path";
import fs from "fs";
function clearNodeLogs(silent = true) {
  const dirPath = path.join(process.cwd(), "tmp", "node_logs");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    !silent && console.log(`Deleting log: ${file}`);
    if (file.endsWith(".log")) {
      fs.unlinkSync(path.join(dirPath, file));
    }
  }
}
function reportLogLocation(silent = false) {
  const dirPath = path.join(process.cwd(), "tmp", "node_logs");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const result = fs.readdirSync(dirPath);
  let consoleMessage = "";
  let filePath = "";
  try {
    filePath = process.env.MOON_ZOMBIE_DIR
      ? process.env.MOON_ZOMBIE_DIR
      : process.env.MOON_LOG_LOCATION
        ? process.env.MOON_LOG_LOCATION
        : path.join(
            dirPath,
            result.find((file) => path.extname(file) === ".log") || "no_logs_found"
          );
    consoleMessage = `  \u{1FAB5}   Log location: ${filePath}`;
  } catch (e) {
    console.error(e);
  }
  !silent && console.log(consoleMessage);
  return filePath.trim();
}
export { clearNodeLogs, reportLogLocation };
