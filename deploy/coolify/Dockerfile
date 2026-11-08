# syntax=docker/dockerfile:1
# Storify built ON the server (Coolify), for a host with RAM to spare for the
# compile. A server that also has to keep a busy store responsive should use
# the prebuilt path instead (deploy/Dockerfile + .github/workflows/deploy-image.yml).
FROM node:24-bookworm-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Bangkok
RUN corepack enable
WORKDIR /app

# Dependencies first, so a source-only change reuses this layer. Dev
# dependencies stay: `pnpm create-admin` and `pnpm db:migrate` run with tsx
# from a container terminal.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs .npmrc ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# they arrive as build args and must equal the store's public settings.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_LOYALTY_ENABLED
ARG NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_FACEBOOK_PIXEL_ID
ARG NEXT_PUBLIC_TIKTOK_PIXEL_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_LOYALTY_ENABLED=$NEXT_PUBLIC_LOYALTY_ENABLED \
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=$NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY \
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=$NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_FACEBOOK_PIXEL_ID=$NEXT_PUBLIC_FACEBOOK_PIXEL_ID \
    NEXT_PUBLIC_TIKTOK_PIXEL_ID=$NEXT_PUBLIC_TIKTOK_PIXEL_ID

RUN NODE_OPTIONS=--max-old-space-size=8192 pnpm build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start", "--hostname", "0.0.0.0", "--port", "3000"]
