# Build web + api; runtime = hasil `pnpm deploy` (self-contained, tanpa symlink).
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY .npmrc pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --no-frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @nas/shared build && pnpm --filter api build && pnpm --filter web build \
 && pnpm --filter api --prod --legacy deploy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out /app
COPY --from=build /app/apps/api/db /app/db
COPY --from=build /app/apps/web/dist /app/web-dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
