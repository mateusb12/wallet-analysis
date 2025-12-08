FROM python:3.12-slim

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry
ENV POETRY_VERSION=1.8.3
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Copy poetry configs
COPY backend/pyproject.toml backend/poetry.lock* ./

# Install dependencies (NO dev deps in production!)
RUN poetry install --no-root --no-interaction --no-ansi

# Copy the actual app source
COPY backend /app

# Default mode
ENV APP_ENV=production

CMD ["sh", "-c", "\
    if [ \"$APP_ENV\" = \"development\" ]; then \
        poetry run uvicorn app:app --host 0.0.0.0 --port 8000 --reload; \
    else \
        poetry run uvicorn app:app --host 0.0.0.0 --port 8000; \
    fi \
"]