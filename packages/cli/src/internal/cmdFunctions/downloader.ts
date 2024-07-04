import { SingleBar, Presets } from "cli-progress";
import fs from "node:fs";
import { Readable } from "node:stream";

interface ProgressBarOptions {
  etaAsynchronousUpdate: boolean;
  etaBuffer: number;
  format: string;
}

export async function downloader(url: string, outputPath: string): Promise<void> {
  const tempPath = `${outputPath}.tmp`;
  const writeStream = fs.createWriteStream(tempPath);
  let transferredBytes = 0;

  if (url.startsWith("ws")) {
    console.log("You've passed a WebSocket URL to fetch. Is this intended?");
  }

  const response = await fetch(url);

  if (!response.body) {
    throw new Error("No response body");
  }

  const readStream = Readable.fromWeb(response.body);
  const contentLength = Number.parseInt(response.headers.get("Content-Length") || "0");

  const progressBar = initializeProgressBar();
  progressBar.start(contentLength, 0);

  readStream.pipe(writeStream);

  await new Promise<void>((resolve, reject) => {
    readStream.on("data", (chunk: Buffer) => {
      transferredBytes += chunk.length;
      progressBar.update(transferredBytes);
    });

    readStream.on("end", () => {
      writeStream.end();
      progressBar.stop();
      process.stdout.write("  💾 Saving binary artifact...");
      writeStream.close(() => resolve());
    });

    readStream.on("error", (error: Error) => {
      reject(error);
    });
  });

  fs.writeFileSync(outputPath, fs.readFileSync(tempPath));
  fs.rmSync(tempPath);
}

function initializeProgressBar(): SingleBar {
  const options: ProgressBarOptions = {
    etaAsynchronousUpdate: true,
    etaBuffer: 40,
    format: "Downloading: [{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total}",
  };

  return new SingleBar(options, Presets.shades_classic);
}
