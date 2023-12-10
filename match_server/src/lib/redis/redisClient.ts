import { RedisClientType, createClient } from "redis";
import 'dotenv/config'

declare global {
    var RedisClient: RedisClientType
}

if (process.env.REDIS_URL) {
    global.RedisClient = globalThis.RedisClient ?? createClient({
        url: process.env.REDIS_URL
    })

} else {
    throw new Error('REDIS_URL is undefined.')
}

const redisClient = globalThis.RedisClient

export default redisClient


