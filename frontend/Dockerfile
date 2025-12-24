# ---------- STAGE 1: BUILDER ----------
FROM node:20-slim AS builder

WORKDIR /app

# Desativar TODOS os scripts do npm (inclui prepare/husky)
ENV NPM_CONFIG_IGNORE_SCRIPTS=true

# Copia apenas package*.json
COPY package.json package-lock.json ./

# Instala dependências sem dev
RUN npm ci

# Agora copia o restante do frontend
COPY . .

# Build do Vite
RUN npm run build


# ---------- RUNTIME ----------
FROM nginx:alpine AS production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
