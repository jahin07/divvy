# Stage 1 — build the React frontend into static/dist
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# vite.config.ts builds to ../static/dist → /app/static/dist
RUN npm run build

# Stage 2 — Python runtime serving the API + the built frontend
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py bill_split.py splitwise_client.py receipt_scan.py ./
COPY --from=frontend /app/static/dist ./static/dist

# Render (and most hosts) inject $PORT; default to 8000 for local `docker run`.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60"]
