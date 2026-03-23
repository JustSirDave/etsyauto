FROM node:20-alpine

WORKDIR /app

# Accept build arguments
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG API_INTERNAL_URL

# Set as environment variables for build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies
COPY package.json ./
RUN npm install

# Copy application code
COPY . .

# Build application


# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "run", "dev"]
