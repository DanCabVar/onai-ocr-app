# =====================================
# Multi-stage build para Frontend (Next.js)
# =====================================

# Etapa 1: Build
FROM node:20-alpine AS builder

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY . .

# No longer need NEXT_PUBLIC_API_URL at build time — API calls use relative
# URLs (/api/*) which are proxied via next.config.mjs rewrites at runtime.

# Compilar la aplicación Next.js
RUN pnpm run build

# Etapa 2: Producción
FROM node:20-alpine AS production

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# Copiar el build de Next.js
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# Exponer el puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
# Backend URL for Next.js rewrites (docker-compose service name)
ENV BACKEND_URL=http://backend:4000

# Comando para iniciar Next.js
CMD ["pnpm", "start"]

