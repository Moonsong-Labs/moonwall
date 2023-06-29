import path from "path";
import fs from "fs";

export function clearNodeLogs() {
  // TODO: check if logs exist already and purge unless command set in config
  const dirPath = path.join(process.cwd(), "tmp", "node_logs");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Check for existing log files and delete
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file.endsWith(".log")) {
      fs.unlinkSync(path.join(dirPath, file));
    }
  }
}

export function reportLogLocation() {
  const dirPath = path.join(process.cwd(), "tmp", "node_logs");
  const result = fs.readdirSync(dirPath);
  let filePath = "";
  try {
    filePath = `  🪵   Log location: ${path.join(
      dirPath,
      result.find((file) => path.extname(file) == ".log")!
    )}`;
  } catch (e) {
    console.error(e);
  }

  console.log(filePath);
  return filePath;
}
