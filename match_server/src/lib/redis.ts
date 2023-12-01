import { createClient } from "redis";
import { SchemaFieldTypes } from "redis";

(async () => {
    try {
        const redisClient = createClient({
            url: 'redis://localhost:6379'
        })
        await redisClient.connect()
        
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
    }
})()