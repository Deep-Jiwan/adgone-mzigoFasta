# Build from the repo root: docker build -f services/bridge/Dockerfile .
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY services/bridge services/bridge
RUN pnpm install --frozen-lockfile --filter @mzigo/bridge... \
 && pnpm --filter @mzigo/bridge build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/services/bridge/dist/main.js ./main.js
USER node
CMD ["node", "main.js"]
