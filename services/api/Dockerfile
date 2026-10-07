# Контекст сборки — корень репозитория (нужны schemas/ и content/).
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    DATA_DIR=/data CONTENT_DIR=/srv/content SCHEMAS_DIR=/srv/schemas

RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/api
COPY services/api/requirements.txt services/api/requirements-dev.txt ./
RUN pip install -r requirements.txt -r requirements-dev.txt

COPY schemas /srv/schemas
COPY content /srv/content
COPY services/api ./

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/meta/formats',timeout=4).status==200 else 1)"
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --log-level warning"]
