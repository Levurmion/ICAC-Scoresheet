import { createClient } from "redis";
import { SchemaFieldTypes } from "redis";
import 'dotenv/config'

const redisClient = createClient({
    url: process.env.REDIS_URL
});

(async () => {
    try {
        await redisClient.connect()

        // set up keyspace notifications
        await redisClient.CONFIG_SET("notify-keyspace-events", "Ex")
        
        // create index
        await redisClient.ft.CREATE("idx:matches", {
            "$.name": {
                type: SchemaFieldTypes.TEXT,
                AS: "name"
            },
            "$.host": {
                type: SchemaFieldTypes.TAG,
                AS: "host"
            },
            "$.current_state": {
                type: SchemaFieldTypes.TEXT,
                AS: "current_state"
            },
            "$.previous_state": {
                type: SchemaFieldTypes.TEXT,
                AS: "previous_state"
            }
        }, {
            ON: 'JSON',
            PREFIX: 'match:'
        })

        await redisClient.disconnect()
    }
    catch (error) {
        console.log(error)
        await redisClient.disconnect()
    }
})()