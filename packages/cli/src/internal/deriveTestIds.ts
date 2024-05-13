import chalk from "chalk";
import fs from "node:fs";
import inquirer from "inquirer";
import path from "node:path";

interface DeriveTestIdsOptions {
  rootDir: string;
  prefixDepth?: number;
  prefixName?: string;
}

export async function deriveTestIds(params: DeriveTestIdsOptions) {
  const usedPrefixes: Set<string> = new Set();

  const { rootDir } = params;
  const prefixDepth = params.prefixDepth ?? 1;

  try {
    await fs.promises.access(rootDir, fs.constants.R_OK);
  } catch (error) {
    console.error(
      `🔴 Error accessing directory ${chalk.bold(`/${rootDir}`)}, please sure this exists`
    );
    process.exitCode = 1;
    return;
  }
  console.log(`🟢 Processing ${rootDir} ...`);
  const topLevelDirs = getTopLevelDirs(rootDir);

  const foldersToRename: { prefix: string; dir: string }[] = [];

  for (const dir of topLevelDirs) {
    const prefix = params.prefixName ?? generatePrefix(dir, usedPrefixes);
    foldersToRename.push({ prefix, dir });
  }

  const result = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `This will rename ${foldersToRename.length} suites IDs in ${rootDir}, continue?`,
  });

  if (!result.confirm) {
    console.log("🔴 Aborted");
    return;
  }

  for (const folder of foldersToRename) {
    const { prefix, dir } = folder;
    process.stdout.write(
      `🟢 Changing suite ${dir} to use prefix ${chalk.bold(`(${prefix})`)} ....`
    );

    generateId(path.join(rootDir, dir), rootDir, prefix);
    process.stdout.write(" Done ✅\n");
  }

  console.log(`🏁 Finished renaming rootdir ${chalk.bold(`/${rootDir}`)}`);
}

function getTopLevelDirs(rootDir: string): string[] {
  return fs
    .readdirSync(rootDir)
    .filter((dir) => fs.statSync(path.join(rootDir, dir)).isDirectory());
}

function generatePrefix(directory: string, usedPrefixes: Set<string>): string {
  const sanitizedDir = directory.replace(/[-_ ]/g, "").toUpperCase();
  let prefix = sanitizedDir[0];

  let additionalIndex = 1;
  while (usedPrefixes.has(prefix) && additionalIndex < sanitizedDir.length) {
    prefix += sanitizedDir[additionalIndex];
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
        // 'Z'
        lastChar = 65; // 'A'
      } else {
        lastChar++;
      }
      prefix = sanitizedDir[0] + String.fromCharCode(lastChar);
    }
  }

  usedPrefixes.add(prefix);
  return prefix;
}

function generateId(directory: string, rootDir: string, prefix: string): void {
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

function hasSpecialCharacters(filename: string): boolean {
  return /[ \t!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(filename);
}

function customFileSort(a: string, b: string): number {
  const aHasSpecialChars = hasSpecialCharacters(a);
  const bHasSpecialChars = hasSpecialCharacters(b);

  if (aHasSpecialChars && !bHasSpecialChars) return -1;
  if (!aHasSpecialChars && bHasSpecialChars) return 1;

  return a.localeCompare(b, undefined, { sensitivity: "accent" });
}
