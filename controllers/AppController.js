import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const AppController = {
  /**
   * @param {Request} req Express Request
   * @param {Response} res Express Response
   * @returns {JSON} json response
   */
  async getStatus(req, res) {
    if (redisClient.isAlive() && dbClient.isAlive()) {
      res.status(200).json({ redis: true, db: true });
    }
  },

  /**
   * @param {Request} req Express Request
   * @param {Response} res Express Response
   * @returns {JSON} json response
   */
  async getStats(req, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    res.status(200).json({ users, files });
  },
};

module.exports = AppController;
