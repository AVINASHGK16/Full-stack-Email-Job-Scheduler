import { redisConnection } from '../config/redis';

/**
 * Shared Redis-backed hourly rate limiter.
 *
 * Key format:  ratelimit:sender:<senderId>:hour:<hourBucket>
 * Hour bucket: Math.floor(Date.now() / 3_600_000)  — increments every UTC hour.
 *
 * Atomicity: a Lua script performs CHECK + INCR in a single Redis round-trip,
 * preventing the read-increment race condition across concurrent workers.
 */

const LUA_CHECK_AND_INCREMENT = `
local key     = KEYS[1]
local limit   = tonumber(ARGV[1])
local ttl     = tonumber(ARGV[2])
local current = redis.call('GET', key)
if current and tonumber(current) >= limit then
  return 0
end
local newVal = redis.call('INCR', key)
if newVal == 1 then
  redis.call('EXPIRE', key, ttl)
end
return 1
`;

export class RateLimitService {
  /**
   * Returns the deterministic Redis key for the current hourly window.
   */
  static getKey(senderId: string): string {
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    return `ratelimit:sender:${senderId}:hour:${hourBucket}`;
  }

  /**
   * Atomically checks the hourly counter and increments it if under the limit.
   *
   * @returns true  — slot reserved, send is allowed
   * @returns false — limit reached, send is denied
   */
  static async checkAndIncrement(senderId: string, hourlyLimit: number): Promise<boolean> {
    // TTL: 1 hour + 60 s buffer so the key outlives the window for late arrivals
    const TTL_SECONDS = 3600 + 60;
    const key = RateLimitService.getKey(senderId);

    const result = await (redisConnection as any).eval(
      LUA_CHECK_AND_INCREMENT,
      1,           // number of KEYS
      key,         // KEYS[1]
      hourlyLimit, // ARGV[1]
      TTL_SECONDS  // ARGV[2]
    ) as number;

    return result === 1;
  }

  /**
   * Returns the current counter value for a sender in the current hour.
   * Useful for inspection/testing.
   */
  static async getCurrentCount(senderId: string): Promise<number> {
    const key = RateLimitService.getKey(senderId);
    const value = await redisConnection.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Returns the TTL (seconds) remaining on the current hour's key.
   * Returns -1 if no expiry, -2 if key doesn't exist.
   */
  static async getTTL(senderId: string): Promise<number> {
    const key = RateLimitService.getKey(senderId);
    return redisConnection.ttl(key);
  }
}
