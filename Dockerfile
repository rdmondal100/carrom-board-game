# Carrom Adda: one Dockerfile, two targets.
#   docker build --target server -t carrom-adda-server .
#   docker build --target client -t carrom-adda-client .
# Normally built through docker-compose.yml.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH \
    # mongodb-memory-server (tests only) must not download a Mongo binary.
    MONGOMS_DISABLE_POSTINSTALL=1 \
    CI=true
RUN corepack enable
WORKDIR /repo

# ---- install all workspace dependencies (cached on the lockfile) ----
FROM base AS deps
# Every workspace package needs its package.json line here (add nodipar when it lands).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/rules/package.json packages/rules/
COPY packages/bot/package.json packages/bot/
COPY packages/protocol/package.json packages/protocol/
COPY packages/carrom/package.json packages/carrom/
COPY packages/game-kit/package.json packages/game-kit/
COPY packages/cards/package.json packages/cards/
COPY packages/callbreak/package.json packages/callbreak/
COPY packages/ludo/package.json packages/ludo/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

# ---- server: esbuild bundle + production node_modules ----
FROM source AS server-build
RUN pnpm -F @carrom/server exec node build.mjs \
 && pnpm -F @carrom/server deploy --prod --legacy /out \
 && rm -rf /out/src /out/*.test.ts \
 && cp -r apps/server/dist /out/dist

FROM node:24-alpine AS server
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY --from=server-build --chown=node:node /out ./
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health >/dev/null || exit 1
CMD ["node", "dist/index.js"]

# ---- client: static Vite build served by nginx ----
FROM source AS client-build
# Vite bakes VITE_* in at build time.
ARG VITE_API_BASE_URL=http://localhost:5000
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_ADS_MENU_BANNER=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_ADS_MENU_BANNER=$VITE_ADS_MENU_BANNER
RUN pnpm -F @carrom/client exec vite build

FROM nginx:1.27-alpine AS client
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /repo/apps/client/dist /usr/share/nginx/html
EXPOSE 80
