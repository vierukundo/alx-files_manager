// utils/redis.js
import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = createClient();

    this.client.on('error', (err) => {
      console.error(err);
    });
  }

  /**
   * Checks if connection to redis is active
   * @returns {boolean} connection status
   */
  isAlive() {
    const c = this.client.connected;
    return c;
  }

  /**
   * @param {string} key given key to search with
   * @returns {string} value from redis
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, value) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  }

  /**
   * @param {any} key to store value with
   * @param {any} value of the key
   * @param {any} duration lifetime of the key
   * @returns {none} if success return none else reject
   */
  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.setex(key, duration, value, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
