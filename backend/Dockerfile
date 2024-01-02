# create base image of dependencies for development
FROM node:16-alpine3.18 as dev

# Install Python and build dependencies for node gyp
# Set Python3 as the default Python version
RUN apk add --no-cache python3 make g++
RUN ln -sf python3 /usr/bin/python

RUN npm install -g nodemon

WORKDIR /app/

COPY package*.json .

RUN npm install

COPY . .

# image compiling TS into production build
FROM node:16-alpine3.18 as tsbuild

# Install Python and build dependencies for node gyp
# Set Python3 as the default Python version
RUN apk add --no-cache python3 make g++
RUN ln -sf python3 /usr/bin/python

WORKDIR /app/

COPY package*.json .
COPY tsconfig.json .

RUN npm install --omit=dev

COPY src /app/src

RUN npx tsc

# after Typescript compiles, run the app
FROM node:16-alpine3.18 as prod

WORKDIR /app/

RUN npm install pm2 -g

COPY --from=tsbuild /app/package*.json /app
COPY --from=tsbuild /app/node_modules /app/node_modules
COPY --from=tsbuild /app/dist /app/dist

EXPOSE 3001

CMD npm run db-setup && npm run start

