FROM node:24-alpine
WORKDIR /cron
COPY vercel.json ./vercel.json
COPY deploy/coolify/cron-runner.mjs ./cron-runner.mjs
CMD ["node", "cron-runner.mjs"]
