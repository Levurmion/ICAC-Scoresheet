import { RedisClientType, createClient } from "redis";
import 'dotenv/config'

declare global {
    var redisClient: RedisClientType
}

if (process.env.REDIS_URL) {
    global.redisClient = globalThis.redisClient ?? createClient({
        url: process.env.REDIS_URL
    })

} else {
    throw new Error('REDIS_URL is undefined.')
}

const redisClient = globalThis.redisClient

export default redisClient


