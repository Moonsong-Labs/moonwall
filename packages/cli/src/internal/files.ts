import fs from "node:fs";
import chalk from "chalk";
import os from "node:os";

export async function checkExists(path: string) {
  const binPath = path.split(" ")[0];
  const fsResult = fs.existsSync(binPath);
  if (!fsResult) {
    throw new Error(
      `No binary file found at location: ${binPath} \n Are you sure your ${chalk.bgWhiteBright.blackBright(
        "moonwall.config.json"
      )} file has the correct "binPath" in launchSpec?`
    );
  }

  const binArch = await getBinaryArchitecture(binPath);
  const currentArch = os.arch();
  if (binArch !== currentArch && binArch !== "unknown") {
    throw new Error(
      `The binary architecture ${chalk.bgWhiteBright.blackBright(
        binArch
      )} does not match this system's architecture ${chalk.bgWhiteBright.blackBright(
        currentArch
      )}\nDownload or compile a new binary executable for ${chalk.bgWhiteBright.blackBright(
        currentArch
      )} `
    );
  }

  return true;
}

export function checkAccess(path: string) {
  const binPath = path.split(" ")[0];
  try {
    fs.accessSync(binPath, fs.constants.X_OK);
  } catch (err) {
    console.error(`The file ${binPath} is not executable`);
    throw new Error(`The file at ${binPath} , lacks execute permissions.`);
  }
}

async function getBinaryArchitecture(filePath: string) {
  return new Promise((resolve, reject) => {
    const architectureMap = {
      0x0: "unknown",
      0x03: "x86",
      0x3e: "x64",
      0xb7: "arm64",
    };

    fs.open(filePath, "r", (err, fd) => {
      if (err) {
        reject(err);
        return;
      }

      const buffer = Buffer.alloc(20);
      fs.read(fd, buffer, 0, 20, 0, (err, bytesRead, buffer) => {
        if (err) {
          reject(err);
          return;
        }

        if (
          buffer.readUInt8(0) !== 0x7f ||
          buffer.readUInt8(1) !== 0x45 ||
          buffer.readUInt8(2) !== 0x4c ||
          buffer.readUInt8(3) !== 0x46
        ) {
          reject(new Error("Not an ELF file"));
          return;
        }

        const e_machine = buffer.readUInt16LE(18);
        const architecture = architectureMap[e_machine] || "unknown";
        resolve(architecture);
      });
    });
  });
}
