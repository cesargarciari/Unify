# here is our backend dockerfile
FROM python:3.11-slim AS base

 WORKDIR /app

# using python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# system Deps:
# build-essential = compile wheels if needed
# curl = used by our Docker-compose healthcheck curl http://localhost:8000/health)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       curl \
    && rm -rf /var/lib/apt/lists/*

# make sure to install Python deps
# then ensure backend/requirements.txt exists and is committed
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
# Expecting FastAPI app under app/ with main.py exposing "app"
COPY . .

# xxpose the backend port compose maps 8000:8000
EXPOSE 8000

# lastly start FastAPI with uvicorn which matches docker-compose `healthcheck`
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000" ]
