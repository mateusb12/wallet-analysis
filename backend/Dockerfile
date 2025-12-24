# ---------- STAGE 1: BUILDER ----------
FROM python:3.12-slim AS builder

# Install system deps required to build wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry
ENV POETRY_VERSION=1.8.3
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Copia arquivos de dependência para a raiz do build
COPY pyproject.toml poetry.lock* ./

# Generate requirements.txt and build wheel packages
RUN poetry export --without-hashes --format=requirements.txt > requirements.txt

# Build wheels
RUN pip wheel --wheel-dir=/wheelhouse -r requirements.txt


# ---------- STAGE 2: RUNTIME ----------
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies from wheels
COPY --from=builder /wheelhouse /wheelhouse
RUN pip install --no-cache-dir /wheelhouse/*

# --- AQUI ESTÁ O TRUQUE PARA OS IMPORTS FUNCIONAREM ---
# 1. Copiamos o código para uma subpasta 'backend' para criar a estrutura de pacote
COPY . ./backend

# 2. Adicionamos /app ao PYTHONPATH para o Python encontrar o pacote 'backend'
ENV PYTHONPATH=/app

ENV APP_ENV=production

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]