# Lightweight Pixi Lab demo preview image.
# Runs the Vite demo app on container port 5173.
FROM node:20-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.config.ts ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile

EXPOSE 5173

CMD ["pnpm", "--filter", "@hooksjam/pixi-lab-demo", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
