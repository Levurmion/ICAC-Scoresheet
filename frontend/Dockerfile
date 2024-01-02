FROM node:18-alpine3.18 as dev

# Install Python and build dependencies for node gyp
# Set Python3 as the default Python version
RUN apk add --no-cache python3 make g++
RUN ln -sf python3 /usr/bin/python

WORKDIR /app/

COPY package*.json .
RUN npm install

COPY . .

# next build
FROM node:18-alpine3.18 as nextbuild

# Install Python and build dependencies for node gyp
# Set Python3 as the default Python version
RUN apk add --no-cache python3 make g++
RUN ln -sf python3 /usr/bin/python

WORKDIR /app/

COPY package*.json .
RUN npm install

COPY . .

RUN npm run build

# production only requiring the .next directory
FROM node:18-alpine3.18 as nextprod

# Install Python and build dependencies for node gyp
# Set Python3 as the default Python version
RUN apk add --no-cache python3 make g++
RUN ln -sf python3 /usr/bin/python

WORKDIR /app/

COPY --from=nextbuild /app/package*.json /app
RUN npm install --omit=dev

COPY --from=nextbuild /app/.next /app/.next

EXPOSE 3000

CMD ["npm", "run", "start"]



