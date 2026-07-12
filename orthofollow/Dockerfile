FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifests
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

# Build em ordem de dependencia
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/ca
RUN npm run build --workspace=packages/math
RUN npm run build --workspace=packages/knw
RUN npm run build --workspace=packages/wf
RUN npm run build --workspace=packages/pcf
RUN npm run build --workspace=packages/api

# Runtime
FROM node:22-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY --from=builder /app/node_modules        ./node_modules
COPY --from=builder /app/packages            ./packages
COPY apps/web                                ./apps/web
COPY migrations                              ./migrations
ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_ROOT=/app/apps/web

EXPOSE 3000

CMD ["node", "/app/packages/api/dist/server.js"]
