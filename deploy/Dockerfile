FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
WORKDIR /app/backend
COPY backend/ ./
RUN pip install --no-cache-dir -c requirements.lock '.[ai]'
COPY --from=web /web/dist /app/frontend/dist
RUN useradd --uid 10001 --create-home findback && mkdir -p /app/backend/data/uploads /app/backend/data/models && chown -R findback:findback /app
USER findback
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips","172.28.0.10","--no-access-log"]
