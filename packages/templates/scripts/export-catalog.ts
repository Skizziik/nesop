/** Экспорт каталога мультиков в JSON для Python: services/api/app/pipeline/cartoon_catalog.json */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { exportCatalog } from "../src/cartoon/catalog";

export const CATALOG_JSON = join(import.meta.dirname, "..", "..", "..", "services", "api", "app", "pipeline", "cartoon_catalog.json");
const text = JSON.stringify(exportCatalog(), null, 2) + "\n";
writeFileSync(CATALOG_JSON, text, "utf-8");
console.log(`catalog → ${CATALOG_JSON}`);
