import type { NextConfig } from "next";
import { join } from "node:path";

// Браузер ходит на тот же origin: /api и /media проксируются в FastAPI (без CORS).
const API = process.env.API_INTERNAL_URL ?? "http://api:8000";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "..", ".."),
  transpilePackages: ["@ipt/templates"],
  compress: false, // иначе SSE буферизуется
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/media/:path*", destination: `${API}/media/:path*` },
    ];
  },
};

export default config;
