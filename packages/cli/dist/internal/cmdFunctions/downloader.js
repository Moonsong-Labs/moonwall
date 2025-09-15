// src/internal/cmdFunctions/downloader.ts
import { SingleBar, Presets } from "cli-progress";
import fs from "fs";
import { Readable } from "stream";
async function downloader(url, outputPath) {
  const tempPath = `${outputPath}.tmp`;
  const writeStream = fs.createWriteStream(tempPath);
  let transferredBytes = 0;
  if (url.startsWith("ws")) {
    console.log("You've passed a WebSocket URL to fetch. Is this intended?");
  }
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.body) {
    throw new Error("No response body");
  }
  const readStream = Readable.fromWeb(response.body);
  const contentLength = Number.parseInt(response.headers.get("Content-Length") || "0");
  const progressBar = initializeProgressBar();
  progressBar.start(contentLength, 0);
  readStream.pipe(writeStream);
  await new Promise((resolve, reject) => {
    readStream.on("data", (chunk) => {
      transferredBytes += chunk.length;
      progressBar.update(transferredBytes);
    });
    readStream.on("end", () => {
      writeStream.end();
      progressBar.stop();
      process.stdout.write("  \u{1F4BE} Saving binary artifact...");
      writeStream.close(() => resolve());
    });
    readStream.on("error", (error) => {
      reject(error);
    });
  });
  fs.writeFileSync(outputPath, fs.readFileSync(tempPath));
  fs.rmSync(tempPath);
}
function initializeProgressBar() {
  const options = {
    etaAsynchronousUpdate: true,
    etaBuffer: 40,
    format: "Downloading: [{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total}",
  };
  return new SingleBar(options, Presets.shades_classic);
}
export { downloader, initializeProgressBar };
