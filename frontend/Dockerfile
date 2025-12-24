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

# --- NEW SECTION START ---
# Declare build arguments (these come from the deploy command)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

# Map them to environment variables so Vite can read them during build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
# --- NEW SECTION END ---

# Build do Vite
RUN npm run build


# ---------- RUNTIME ----------
FROM nginx:alpine AS production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]