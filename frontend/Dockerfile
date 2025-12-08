FROM node:20

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend /app

# Default: production
ENV APP_ENV=production

CMD ["sh", "-c", "\
  if [ \"$APP_ENV\" = \"development\" ]; then \
      npm run dev -- --host; \
  else \
      npm run build && npm run preview -- --host; \
  fi \
"]
