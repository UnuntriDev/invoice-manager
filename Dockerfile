FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# Railway uruchamia pre-deploy command z finalnego obrazu. Ten etap dostarcza
# wyłącznie CLI Prisma potrzebne do migracji, bez kopiowania całego node_modules
# z zależnościami deweloperskimi do runtime.
FROM base AS prisma-cli
ARG PRISMA_VERSION=7.8.0
RUN npm install --global "prisma@${PRISMA_VERSION}"

# Migracje są osobnym, jednorazowym krokiem release. Nie konkurują w wielu
# replikach aplikacji i nie wymagają kopiowania całego node_modules do runtime.
FROM deps AS migrator
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
ENV NODE_ENV=production
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/uploads \
  && chown nextjs:nodejs /app/uploads

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=prisma-cli --chown=nextjs:nodejs /usr/local/lib/node_modules/prisma ./node_modules/prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# JSON form przekazuje SIGTERM bezpośrednio do serwera Next.js.
CMD ["node", "server.js"]
