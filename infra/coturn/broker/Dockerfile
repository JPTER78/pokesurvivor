FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
# Package managers are build-time tools, not part of the credential service.
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY core.mjs server.mjs ./
USER node
CMD ["node", "server.mjs"]
