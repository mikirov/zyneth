import Redis from 'ioredis'
import { REDIS_URL } from './config'

export const redis = REDIS_URL ? new Redis(REDIS_URL) : null
