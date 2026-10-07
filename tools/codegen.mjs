// Генерация TS-типов из /schemas в packages/templates/src/generated.
// Запуск: `pnpm codegen` (запись) или `pnpm codegen --check` (падает, если файлы устарели).
import { compileFromFile } from "json-schema-to-typescript";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = join(root, "schemas");
const outDir = join(root, "packages", "templates", "src", "generated");
const check = process.argv.includes("--check");

const BANNER = "/* eslint-disable */\n// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.\n";

const files = [
  ...readdirSync(schemasDir).filter((f) => f.endsWith(".schema.json")).map((f) => join(schemasDir, f)),
  ...readdirSync(join(schemasDir, "formats")).filter((f) => f.endsWith(".schema.json")).map((f) => join(schemasDir, "formats", f)),
];

mkdirSync(outDir, { recursive: true });
let stale = [];
const names = [];
for (const file of files.sort()) {
  const name = basename(file, ".schema.json");
  names.push(name);
  const ts = await compileFromFile(file, {
    cwd: dirname(file),
    bannerComment: BANNER,
    additionalProperties: false,
    ignoreMinAndMaxItems: true,
    style: { singleQuote: false, semi: true },
    declareExternallyReferenced: true,
  });
  const out = join(outDir, `${name}.ts`);
  if (check) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== ts) stale.push(out);
  } else {
    writeFileSync(out, ts);
  }
}

const index = BANNER + names.map((n) => `export type * from "./${n}";`).join("\n") + "\n";
const indexPath = join(outDir, "index.ts");
if (check) {
  if (!existsSync(indexPath) || readFileSync(indexPath, "utf8") !== index) stale.push(indexPath);
  if (stale.length) {
    console.error("Сгенерированные типы устарели, запусти `pnpm codegen`:\n" + stale.join("\n"));
    process.exit(1);
  }
  console.log("codegen: всё актуально");
} else {
  writeFileSync(indexPath, index);
  console.log(`codegen: ${names.length} схем → ${outDir}`);
}
