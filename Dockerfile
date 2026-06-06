# Dockerfile for Full-Stack Node.js (Express + Vite)
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the frontend assets
RUN npm run build

# Cloud Run defaults to port 3000 in this environment set up
ENV PORT=3000
EXPOSE 3000

# Start the server
CMD ["npm", "run", "start"]
