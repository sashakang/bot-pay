# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server

# Install dependencies
RUN npm install

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server

# Install production dependencies only
RUN npm install --production

# Copy built artifacts from builder
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
