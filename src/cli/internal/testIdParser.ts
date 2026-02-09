import { type SgNode, Lang, parse, findInFiles } from "@ast-grep/napi";
import { regex } from "arkregex";

/** Matches leading/trailing quotes (single, double, backtick) */
const quotesRegex = regex("^['\"`]|['\"`]$", "g");

export interface TestIds {
  suiteId: string | undefined;
  testIds: string[];
}

/**
 * Extracts the "id" property value from an object literal AST node.
 * Traverses children to find a "pair" node where the key is "id".
 */
function extractIdFromObject(objNode: SgNode): string | undefined {
  for (const child of objNode.children()) {
    if (child.kind() === "pair") {
      const key = child.field("key");
      const value = child.field("value");
      if (key?.text() === "id" && value) {
        // Remove quotes from the string literal
        return value.text().replace(quotesRegex, "");
      }
    }
  }
  return undefined;
}

/**
 * Finds the "id" property node within an object literal for replacement.
 */
function findIdValueNode(objNode: SgNode): SgNode | undefined {
  for (const child of objNode.children()) {
    if (child.kind() === "pair") {
      const key = child.field("key");
      const value = child.field("value");
      if (key?.text() === "id" && value) {
        return value;
      }
    }
  }
  return undefined;
}

/**
 * Extracts suite and test IDs from a Moonwall test file using AST parsing.
 * This is more robust than regex as it handles comments, multiline formatting, etc.
 */
export function extractTestIds(fileContent: string): TestIds {
  const ast = parse(Lang.TypeScript, fileContent);
  const root = ast.root();

  // Find describeSuite({ id: "...", ... })
  const describeSuiteCall = root.find("describeSuite($OPTS)");
  let suiteId: string | undefined;

  if (describeSuiteCall) {
    const optsNode = describeSuiteCall.getMatch("OPTS");
    if (optsNode && optsNode.kind() === "object") {
      suiteId = extractIdFromObject(optsNode);
    }
  }

  // Find all it({ id: "...", ... }) calls
  const testIds: string[] = [];
  const itCalls = root.findAll("it($OPTS)");

  for (const itCall of itCalls) {
    const optsNode = itCall.getMatch("OPTS");
    if (optsNode && optsNode.kind() === "object") {
      const testId = extractIdFromObject(optsNode);
      if (testId) {
        testIds.push(testId);
      }
    }
  }

  return { suiteId, testIds };
}

/**
 * Replaces the suite ID in a Moonwall test file.
 * Returns the modified file content, or undefined if no describeSuite was found.
 */
export function replaceSuiteId(fileContent: string, newId: string): string | undefined {
  const ast = parse(Lang.TypeScript, fileContent);
  const root = ast.root();

  // Find describeSuite({ id: "...", ... })
  const describeSuiteCall = root.find("describeSuite($OPTS)");

  if (!describeSuiteCall) {
    return undefined;
  }

  const optsNode = describeSuiteCall.getMatch("OPTS");
  if (!optsNode || optsNode.kind() !== "object") {
    return undefined;
  }

  // Find the id property value node
  const idValueNode = findIdValueNode(optsNode);
  if (!idValueNode) {
    return undefined;
  }

  // Determine the quote style used in the original
  const originalText = idValueNode.text();
  const quoteChar = originalText[0];

  // Create edit to replace the ID value
  const edit = idValueNode.replace(`${quoteChar}${newId}${quoteChar}`);
  return root.commitEdits([edit]);
}

/**
 * Checks if a file contains a describeSuite call (is a Moonwall test file).
 */
export function hasSuiteDefinition(fileContent: string): boolean {
  const ast = parse(Lang.TypeScript, fileContent);
  const root = ast.root();
  return root.find("describeSuite($$$)") !== null;
}

export interface MatchedTestFile {
  filePath: string;
  suiteId: string;
  testIds: string[];
}

/**
 * Finds all test files matching the pattern using ast-grep's parallel file search.
 * Uses Rust threads for efficient parsing and searching.
 *
 * @param testDirs - Directories to search for test files
 * @param includeGlobs - Glob patterns for files to include (e.g., ["*test*.ts", "*spec*.ts"])
 * @param idPattern - Regex pattern to match against suite/test IDs
 * @returns Promise resolving to array of matching file paths
 */
export async function findTestFilesMatchingPattern(
  testDirs: string[],
  includeGlobs: string[],
  idPattern: RegExp
): Promise<string[]> {
  const matches: string[] = [];
  let processedCount = 0;
  let expectedCount: number | undefined;

  await new Promise<void>((resolve, reject) => {
    findInFiles(
      Lang.TypeScript,
      {
        paths: testDirs,
        matcher: { rule: { pattern: "describeSuite($OPTS)" } },
        languageGlobs: includeGlobs,
      },
      (err, nodes) => {
        if (err) {
          reject(err);
          return;
        }

        if (nodes.length === 0) return;

        // Get file info from the first node
        const node = nodes[0];
        const filePath = node.getRoot().filename();
        const root = node.getRoot().root();

        // Extract suite ID from the describeSuite call
        const optsNode = node.getMatch("OPTS");
        if (!optsNode || optsNode.kind() !== "object") return;

        const suiteId = extractIdFromObject(optsNode);
        if (!suiteId) return;

        // Extract test IDs
        const testIds: string[] = [];
        const itCalls = root.findAll("it($OPTS)");
        for (const itCall of itCalls) {
          const itOpts = itCall.getMatch("OPTS");
          if (itOpts && itOpts.kind() === "object") {
            const testId = extractIdFromObject(itOpts);
            if (testId) testIds.push(testId);
          }
        }

        // Check if any ID matches the pattern
        const allIds = [suiteId, ...testIds.map((tid) => suiteId + tid)];
        if (allIds.some((id) => idPattern.test(id))) {
          matches.push(filePath);
        }

        processedCount++;
        if (expectedCount !== undefined && processedCount >= expectedCount) {
          resolve();
        }
      }
    )
      .then((count) => {
        expectedCount = count;
        // If all files already processed or no files found, resolve immediately
        if (count === 0 || processedCount >= count) {
          resolve();
        }
      })
      .catch(reject);
  });

  return matches;
}
