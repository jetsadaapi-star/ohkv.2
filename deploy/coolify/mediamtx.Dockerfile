# MediaMTX with the production config baked in (no bind mount to resolve).
FROM bluenviron/mediamtx:latest
COPY deploy/coolify/mediamtx.yml /mediamtx.yml
