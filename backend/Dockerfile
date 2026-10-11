FROM node:24-trixie-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS development
ENV NODE_ENV=development
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p generated dist && chown node:node /app /app/generated /app/dist
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run prisma:generate && npm run prisma:migrate:deploy && npm run start:dev -- --no-shell"]

FROM base AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_DATABASE=build MYSQL_USER=build MYSQL_PASSWORD=build npm run prisma:generate \
  && npm run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
