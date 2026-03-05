FROM oven/bun:1.3.5 AS build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --prefer-offline --ignore-scripts

ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TOKEN=$TURBO_TOKEN

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ARG PORT
ENV PORT=$PORT

CMD bun turbo start --filter @zyneth/waitlist-api
