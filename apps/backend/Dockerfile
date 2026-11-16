FROM node:24-slim

WORKDIR /app

RUN mkdir -p /var/cache/tablebuddy/npm && chown -R 999 /var/cache/tablebuddy

USER node

CMD ["npm", "run", "dev"]
