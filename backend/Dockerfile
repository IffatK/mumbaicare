FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["sh", "-c", "npx tsx src/scripts/seed.ts && node dist/index.js"]
