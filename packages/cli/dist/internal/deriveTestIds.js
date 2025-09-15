// src/internal/deriveTestIds.ts
import chalk from "chalk";
import fs from "fs";
import { confirm } from "@inquirer/prompts";
import path from "path";
async function deriveTestIds(params) {
  const usedPrefixes = /* @__PURE__ */ new Set();
  const { rootDir, singlePrefix } = params;
  try {
    await fs.promises.access(rootDir, fs.constants.R_OK);
  } catch (error) {
    console.error(
      `\u{1F534} Error accessing directory ${chalk.bold(`/${rootDir}`)}, please sure this exists`
    );
    process.exitCode = 1;
    return;
  }
  console.log(`\u{1F7E2} Processing ${rootDir} ...`);
  const topLevelDirs = getTopLevelDirs(rootDir);
  const foldersToRename = [];
  if (singlePrefix) {
    const prefix = generatePrefix(rootDir, usedPrefixes, params.prefixPhrase);
    foldersToRename.push({ prefix, dir: "." });
  } else {
    for (const dir of topLevelDirs) {
      const prefix = generatePrefix(dir, usedPrefixes, params.prefixPhrase);
      foldersToRename.push({ prefix, dir });
    }
  }
  const result = await confirm({
    message: `This will rename ${foldersToRename.length} suites IDs in ${rootDir}, continue?`,
  });
  if (!result) {
    console.log("\u{1F534} Aborted");
    return;
  }
  for (const folder of foldersToRename) {
    const { prefix, dir } = folder;
    process.stdout.write(
      `\u{1F7E2} Changing suite ${dir} to use prefix ${chalk.bold(`(${prefix})`)} ....`
    );
    generateId(path.join(rootDir, dir), rootDir, prefix);
    process.stdout.write(" Done \u2705\n");
  }
  console.log(`\u{1F3C1} Finished renaming rootdir ${chalk.bold(`/${rootDir}`)}`);
}
function getTopLevelDirs(rootDir) {
  return fs
    .readdirSync(rootDir)
    .filter((dir) => fs.statSync(path.join(rootDir, dir)).isDirectory());
}
function generatePrefix(directory, usedPrefixes, rootPrefix) {
  const sanitizedDir = directory.replace(/[-_ ]/g, "").toUpperCase();
  let prefix = rootPrefix ?? sanitizedDir[0];
  let additionalIndex = 1;
  while (usedPrefixes.has(prefix) && additionalIndex < sanitizedDir.length) {
    prefix += rootPrefix?.[additionalIndex] ?? sanitizedDir[additionalIndex];
    additionalIndex++;
  }
  let numericSuffix = 0;
  while (usedPrefixes.has(prefix)) {
    if (numericSuffix < 10) {
      numericSuffix++;
      prefix = sanitizedDir[0] + numericSuffix.toString();
    } else {
      let lastChar = prefix.slice(-1).charCodeAt(0);
      if (lastChar >= 90) {
        lastChar = 65;
      } else {
        lastChar++;
      }
      prefix = sanitizedDir[0] + String.fromCharCode(lastChar);
    }
  }
  usedPrefixes.add(prefix);
  return prefix;
}
function generateId(directory, rootDir, prefix) {
  const contents = fs.readdirSync(directory);
  contents.sort((a, b) => {
    const aIsDir = fs.statSync(path.join(directory, a)).isDirectory();
    const bIsDir = fs.statSync(path.join(directory, b)).isDirectory();
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return customFileSort(a, b);
  });
  let fileCount = 1;
  let subDirCount = 1;
  for (const item of contents) {
    const fullPath = path.join(directory, item);
    if (fs.statSync(fullPath).isDirectory()) {
      const subDirPrefix = `0${subDirCount}`.slice(-2);
      generateId(fullPath, rootDir, prefix + subDirPrefix);
      subDirCount++;
    } else {
      const fileContent = fs.readFileSync(fullPath, "utf-8");
      if (fileContent.includes("describeSuite")) {
        const newId = prefix + `0${fileCount}`.slice(-2);
        const updatedContent = fileContent.replace(
          /(describeSuite\s*?\(\s*?\{\s*?id\s*?:\s*?['"])[^'"]+(['"])/,
          `$1${newId}$2`
        );
        fs.writeFileSync(fullPath, updatedContent);
      }
      fileCount++;
    }
  }
}
function hasSpecialCharacters(filename) {
  return /[ \t!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(filename);
}
function customFileSort(a, b) {
  const aHasSpecialChars = hasSpecialCharacters(a);
  const bHasSpecialChars = hasSpecialCharacters(b);
  if (aHasSpecialChars && !bHasSpecialChars) return -1;
  if (!aHasSpecialChars && bHasSpecialChars) return 1;
  return a.localeCompare(b, void 0, { sensitivity: "accent" });
}
export { deriveTestIds };
