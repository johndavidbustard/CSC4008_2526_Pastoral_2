FROM node:20-alpine

# App directory
WORKDIR /usr/src/app

# Install dependencies first (leverages Docker layer caching)
COPY package*.json ./
RUN npm install --production

# Copy application source
COPY . .

# The app listens on port 3000
EXPOSE 3000

# Run the server
CMD ["npm", "start"]
