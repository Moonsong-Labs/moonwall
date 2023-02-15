import fs from "fs/promises";
export async function loadConfig(path) {
    if (!(await fs
        .access(path)
        .then(() => true)
        .catch(() => false))) {
        throw new Error(`Moonwall Config file ${path} cannot be found`);
    }
    const file = await fs.readFile(path, { encoding: "utf-8" });
    const json = JSON.parse(file);
    return json;
}
export async function buildFoundations(config) { }
//# sourceMappingURL=configReader.js.map