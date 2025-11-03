# =====================================
# Multi-stage build para Backend (NestJS)
# =====================================

# Etapa 1: Build
FROM node:20-alpine AS builder

# Instalar pnpm y npm
RUN corepack enable && corepack prepare pnpm@latest --activate && npm install -g npm@latest

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml .npmrc ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile && \
    cd node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt && \
    npm run install --unsafe-perm

# Copiar código fuente
COPY . .

# Compilar la aplicación
RUN pnpm run build

# Etapa 2: Producción
FROM node:20-alpine AS production

# Instalar pnpm, npm, wget para healthcheck y herramientas de build necesarias para bcrypt
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    npm install -g npm@latest && \
    apk add --no-cache wget python3 make g++

WORKDIR /app

# Copiar package.json y .npmrc
COPY package.json pnpm-lock.yaml .npmrc ./

# Instalar dependencias de producción y reconstruir bcrypt
RUN pnpm install --frozen-lockfile --prod && \
    cd node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt && \
    npm run install --unsafe-perm

# Copiar el build desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Exponer el puerto
EXPOSE 4000

# Variables de entorno por defecto (se sobreescriben con docker-compose)
ENV NODE_ENV=production
ENV PORT=4000

# Comando para iniciar la aplicación
CMD ["node", "dist/main.js"]

