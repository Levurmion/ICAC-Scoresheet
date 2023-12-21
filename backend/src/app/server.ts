const path = require("path")
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
})

import app from "./app";
import redisClient from "../lib/redis/redisClient";

const server = app.listen(3001, async () => {
    console.log('Application listening on port 3001')
    await redisClient.connect()
})


// shutdown function
function shutdownCb () {
    server.close(async () => {
        await redisClient.disconnect()
        process.exit(0)
    })
}

// graceful shutdown handlers
process.on('SIGINT', shutdownCb);
process.on('SIGTERM', shutdownCb);
process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
});