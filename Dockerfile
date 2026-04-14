FROM ghcr.io/puppeteer/puppeteer:21.6.1

USER root
WORKDIR /app

# Copy the parts list first
COPY package.json ./

# Install the tools
RUN npm install

# Copy EVERYTHING else from your GitHub into the server
COPY . .

# Tell Render to use Port 3000
ENV PORT=3000
EXPOSE 3000

# Start the engine
CMD ["node", "server.js"]
