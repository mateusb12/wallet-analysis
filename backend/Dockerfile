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

# Copy only dependency files first (better caching)
COPY backend/pyproject.toml backend/poetry.lock* ./

# Generate requirements.txt and build wheel packages
RUN poetry export --without-hashes --format=requirements.txt > requirements.txt

# Install dependencies into /wheelhouse (no poetry in final image)
RUN pip wheel --wheel-dir=/wheelhouse -r requirements.txt


# ---------- STAGE 2: RUNTIME ----------
FROM python:3.12-slim

# Install only what FastAPI runtime needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy wheels generated in builder
COPY --from=builder /wheelhouse /wheelhouse
RUN pip install --no-cache-dir /wheelhouse/*

# Copy only application code
COPY backend /app/backend

ENV APP_ENV=production

# Always expose port 8000
EXPOSE 8000

# Run app without poetry (MUCH faster)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
