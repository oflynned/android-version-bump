FROM node:14.17-slim

LABEL "com.github.actions.name"="Automated version bump for Android apps."
LABEL "com.github.actions.description"="Automated version bump for Android apps."
LABEL "com.github.actions.icon"="chevron-up"
LABEL "com.github.actions.color"="blue"

RUN apt-get update
RUN apt-get install -y git

COPY . .

RUN npm ci
RUN npm run build
RUN npm run package
RUN npm prune --production

ENTRYPOINT ["node", "/dist/index.js"]
