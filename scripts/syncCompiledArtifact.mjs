import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const jsonPath = resolve("build", "DeadMansSwitchVault.compiled.json");
const tsPath = resolve("build", "DeadMansSwitchVault.compiled.ts");

const artifact = JSON.parse(readFileSync(jsonPath, "utf8"));
const output = `export const deadMansSwitchVaultCompiled = ${JSON.stringify(artifact, null, 2)} as const;\n`;

writeFileSync(tsPath, output);
