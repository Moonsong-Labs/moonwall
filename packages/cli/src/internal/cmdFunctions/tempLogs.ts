import path from "path";
import fs from "fs";

export function clearNodeLogs(silent: boolean = true) {
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

export function reportLogLocation(silent: boolean = false) {
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
        : path.join(dirPath, result.find((file) => path.extname(file) === ".log")!);
    consoleMessage = `  🪵   Log location: ${filePath}`;
  } catch (e) {
    console.error(e);
  }

  !silent && console.log(consoleMessage);

  return filePath.trim();
}
