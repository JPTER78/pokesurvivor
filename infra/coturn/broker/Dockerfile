FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY core.mjs server.mjs ./
USER node
CMD ["node", "server.mjs"]
