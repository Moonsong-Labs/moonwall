import { SingleBar, Presets } from "cli-progress";
import fetch from "node-fetch";
import fs from "node:fs";

let progressBar: SingleBar;

const onStart = (length) => {
  progressBar = new SingleBar(
    {
      etaAsynchronousUpdate: true,
      etaBuffer: 40,
      format: "Downloading: [{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total}",
    },
    Presets.shades_classic
  );
  progressBar.start(length, 0);
};

const onProgress = (bytes) => {
  progressBar.update(bytes);
};

const onComplete = () => {
  progressBar.stop();
  process.stdout.write(`  💾 Saving binary artefact...`);
};

export async function downloader(url: string, outputPath: string): Promise<void> {
  const tempPath = outputPath + ".tmp";
  const writeStream = fs.createWriteStream(tempPath);
  let transferredBytes = 0;

  const response = await fetch(url);
  const readStream = response.body;

  readStream.pipe(writeStream);

  await new Promise((resolve, reject) => {
    const contentLength = parseInt(response.headers.get("Content-Length") || "0");
    onStart(contentLength);

    readStream.on("data", (chunk) => {
      transferredBytes += chunk.length;
      onProgress(transferredBytes);
    });

    readStream.on("end", () => {
      writeStream.end();
      onComplete();
      writeStream.close(() => resolve("Finished!"));
    });

    readStream.on("error", () => {
      reject("Error!");
    });
  });

  try {
    fs.writeFileSync(outputPath, fs.readFileSync(tempPath));
    fs.rmSync(tempPath);
  } catch (e) {
    throw new Error(e);
  }
}
