# Development-oriented image for NestJS backend.
# Connects to Supabase Postgres via DATABASE_URL; no local database.

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npm run start:dev"]
