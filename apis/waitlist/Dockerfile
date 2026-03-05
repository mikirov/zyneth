FROM oven/bun:1.3.5

WORKDIR /app
COPY . .
RUN bun install --ignore-scripts

ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TOKEN=$TURBO_TOKEN

EXPOSE 3001

CMD ["bun", "run", "--cwd", "apis/waitlist", "start"]
