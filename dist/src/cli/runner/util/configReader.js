"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFoundations = exports.loadConfig = void 0;
const promises_1 = __importDefault(require("fs/promises"));
async function loadConfig(path) {
    if (!(await promises_1.default
        .access(path)
        .then(() => true)
        .catch(() => false))) {
        throw new Error(`Moonwall Config file ${path} cannot be found`);
    }
    const file = await promises_1.default.readFile(path, { encoding: 'utf-8' });
    return JSON.parse(file);
}
exports.loadConfig = loadConfig;
async function buildFoundations(config) { }
exports.buildFoundations = buildFoundations;
//# sourceMappingURL=configReader.js.map