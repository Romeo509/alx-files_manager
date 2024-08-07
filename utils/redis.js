const redis = require('redis');
const { promisify } = require('util');

class RedisClient {
  constructor() {
    this.client = redis.createClient();

    // Promisify Redis methods for async/await usage
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setexAsync = promisify(this.client.setex).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);

    this.client.on('error', (err) => {
      console.error(`Redis connection error: ${err.message}`);
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis server');
    });
  }

  // Check if Redis client is connected
  isAlive() {
    return this.client.connected;
  }

  // Get value associated with the key
  async get(key) {
    try {
      return await this.getAsync(key);
    } catch (err) {
      console.error(`Error getting key ${key}: ${err.message}`);
      return null;
    }
  }

  // Set key-value pair with expiration time
  async set(key, value, duration) {
    try {
      await this.setexAsync(key, duration, value);
    } catch (err) {
      console.error(`Error setting key ${key}: ${err.message}`);
    }
  }

  // Delete key from Redis
  async del(key) {
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error(`Error deleting key ${key}: ${err.message}`);
    }
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
