# Development-oriented image for Next.js frontend.
# Volume mount + WATCHPACK_POLLING enable hot reload; bind to 0.0.0.0 for host access.

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
EXPOSE 3000

CMD ["npx", "next", "dev", "--hostname", "0.0.0.0"]
