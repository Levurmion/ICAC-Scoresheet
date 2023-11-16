FROM node:21-alpine3.18

RUN npm install -g nodemon

WORKDIR /app/

COPY package*.json .

RUN npm install

EXPOSE 3001

CMD ["nodemon", "src/app.ts"]