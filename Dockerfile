FROM node:14.17-alpine

LABEL "com.github.actions.name"="Automated version bump for Android apps."
LABEL "com.github.actions.description"="Automated version bump for Android apps."
LABEL "com.github.actions.icon"="chevron-up"
LABEL "com.github.actions.color"="blue"

COPY package*.json ./

RUN apt-get update
RUN apt-get install -y git
RUN npm ci --only=production

COPY . .

ENTRYPOINT ["node", "index.js"]
