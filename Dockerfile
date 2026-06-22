FROM node:24-slim

LABEL "com.github.actions.name"="Automated version bump for Android apps."
LABEL "com.github.actions.description"="Automated version bump for Android apps."
LABEL "com.github.actions.icon"="chevron-up"
LABEL "com.github.actions.color"="blue"

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /action

COPY package.json package-lock.json ./
RUN HUSKY=0 npm ci

COPY . .
RUN npm run build \
    && npm run package \
    && npm prune --omit=dev

ENTRYPOINT ["node", "/action/dist/index.js"]
