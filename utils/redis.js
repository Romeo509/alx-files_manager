import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = createClient(); // Use createClient from 'redis' directly

    this.client.on('error', (err) => {
      console.error('Redis client not connected to the server:', err);
    });
  }

  async isAlive() {
    return new Promise((resolve) => {
      this.client.ping((err, response) => {
        if (err) {
          resolve(false);
        } else {
          resolve(response === 'PONG');
        }
      });
    });
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.setEx(key, duration, value, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }
}

// Create and export an instance of RedisClient
const redisClient = new RedisClient();
export default redisClient;
