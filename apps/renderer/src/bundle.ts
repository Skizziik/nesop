import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { bundle, webpack } from "@remotion/bundler";

/** Собирает @ipt/templates в Remotion-бандл. Возвращает serveUrl. */
export async function bundleTemplates(outDir?: string): Promise<string> {
  const require = createRequire(import.meta.url);
  const entry = join(dirname(require.resolve("@ipt/templates/package.json")), "src", "entry.ts");
  return bundle({
    entryPoint: entry,
    outDir,
    enableCaching: true,
    // Пакет шаблонов лежит вне проекта Remotion, и его JSX собирается в классическом режиме: подставляем React глобально.
    webpackOverride: (config) => ({
      ...config,
      plugins: [...(config.plugins ?? []), new webpack.ProvidePlugin({ React: "react" })],
    }),
  });
}
