FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json  packages/shared/
COPY packages/ca/package.json      packages/ca/
COPY packages/math/package.json    packages/math/
COPY packages/knw/package.json     packages/knw/
COPY packages/wf/package.json      packages/wf/
COPY packages/pcf/package.json     packages/pcf/
COPY packages/api/package.json     packages/api/

RUN npm install --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/ packages/

RUN npm run build --workspaces

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY --from=builder /app/node_modules        ./node_modules
COPY --from=builder /app/packages            ./packages
COPY apps/web                                ./apps/web
COPY migrations                              ./migrations
COPY start.sh                                ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_ROOT=/app/apps/web

EXPOSE 3000

CMD ["./start.sh"]
