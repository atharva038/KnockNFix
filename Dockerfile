FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the application's internal port
# (We map this to the host port in docker-compose.yml)
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "start"]
