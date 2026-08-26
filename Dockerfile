# Mindstack is one service: it builds the Vite client, then runs the Hono server, which
# in production serves ./dist AND handles /api (see src/server/index.ts). Zeabur builds
# with this file automatically whenever a Dockerfile exists at the repo root.

FROM node:22-slim

WORKDIR /app

# Install ALL dependencies, including devDependencies (vite, tailwind, tsx) — the build
# tools AND the runtime (tsx) live there. --include=dev forces them in even when Zeabur
# injects NODE_ENV=production into the image build; without it npm skips devDependencies
# and `vite build` fails with "vite: not found" (exit 127).
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Build the client bundle into ./dist (vite build). dist is gitignored, so it is never in
# the repo; it must be produced here.
COPY . .
RUN npm run build

# Runtime. NODE_ENV=production is what flips the server into serving ./dist; without it the
# server answers /api only and every page URL 404s. tsx (used by `npm start`) is already in
# node_modules from `npm ci`.
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start"]
