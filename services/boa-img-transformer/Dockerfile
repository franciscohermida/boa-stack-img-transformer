FROM node:22-alpine

RUN npm install -g pnpm

# Set destination for COPY
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY tsconfig.json ./

# Copy container source code
COPY container_src/server.ts ./container_src/
COPY src/schemas.ts ./src/schemas.ts

EXPOSE 3000

# Run
CMD ["pnpm", "start:container"]