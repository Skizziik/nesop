# Контекст сборки — корень репозитория (pnpm workspace).
FROM node:22-bookworm-slim

# Зависимости Chrome Headless Shell (по документации Remotion) + цветные эмодзи.
# ffmpeg не ставим: используется бинарник, который идёт в @remotion/compositor (см. src/ffmpeg.ts).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
      libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
      fonts-noto-color-emoji ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable

WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/templates/package.json packages/templates/
COPY apps/renderer/package.json apps/renderer/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@ipt/renderer..." --filter "italianoperte-farm"

COPY tsconfig.base.json ./
COPY schemas ./schemas
COPY tools ./tools
COPY packages/templates ./packages/templates
COPY apps/renderer ./apps/renderer

# Браузер скачивается при сборке образа, а не при первом рендере
RUN cd apps/renderer && node --input-type=module -e "import {ensureBrowser} from '@remotion/renderer'; await ensureBrowser();"

WORKDIR /repo/apps/renderer
ENV NODE_ENV=production RENDERER_PORT=3100
EXPOSE 3100
CMD ["pnpm", "start"]
