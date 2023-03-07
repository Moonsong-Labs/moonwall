import path from "path";
import fs from "fs";

export function resolve(specifier, parentModuleURL, defaultResolver) {
  specifier = specifier.replace(/^@/, path.resolve(".") + "/src/");
  specifier =
    fs.existsSync(specifier) && fs.lstatSync(specifier).isDirectory()
      ? `${specifier}/index`
      : specifier;
  specifier += ".js";
  return defaultResolver(specifier, parentModuleURL);
}
