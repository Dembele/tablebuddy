# tablebuddy-frontend: Next.js 16 (App Router) on :3000. The image carries only the runtime -
# compose mounts apps/frontend and packages at their host paths (/srv/tablebuddy/...) and sets the
# working dir there, so the deps -> ../../packages symlink resolves inside Turbopack's root;
# node_modules and .next/ live on the host mount (npm i + dev run in this container's command). Backend coupling is HTTP-only: next.config.ts rewrites
# /api/* to BACKEND_API_URL (.env.local), sockets connect from the browser - no cross-app files.
FROM node:24-slim

WORKDIR /app

RUN mkdir -p /var/cache/tablebuddy/npm && chown -R 999 /var/cache/tablebuddy

USER node
CMD ["npm", "run", "dev"]
