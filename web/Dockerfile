FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npm run prisma:seed && npm run dev -- --hostname 0.0.0.0 --port 3000"]
