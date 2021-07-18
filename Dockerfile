FROM node:14.17-slim as build

LABEL "com.github.actions.name"="Automated version bump for Android apps."
LABEL "com.github.actions.description"="Automated version bump for Android apps."
LABEL "com.github.actions.icon"="chevron-up"
LABEL "com.github.actions.color"="blue"

RUN curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | bash -s -- -b /usr/local/bin

WORKDIR /src

COPY . .

RUN apt-get update
RUN apt-get install -y git

RUN npm ci
RUN npm run clean
RUN npm run build
RUN npm run package

RUN npm prune --production
RUN /usr/local/bin/node-prune

FROM node:14.17-slim

WORKDIR /dist

COPY --from=build /src/dist/ ./dist
COPY --from=build /src/node_modules ./node_modules

ENTRYPOINT ["node", "dist/index.js"]
