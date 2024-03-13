// controllers/UsersController.js
import { ObjectID } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import crypto from 'crypto';

const hashPassword = (password) => {
  const sha1 = crypto.createHash('sha1');
  sha1.update(password);
  return sha1.digest('hex');
};

class UsersController {
  static async getMe(req, res) {
    const token = req.header('X-Token');

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userObjID = new ObjectID(userId);
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id: userObjID });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(200).json({ id: user._id.toString(), email: user.email });
  }

  // TODO: Comeback and finish this function
  /** Post new user
   * @param {Request} req
   * @param {Response} res
   * @returns `json` of user_id & email
   */
  static postNew(req, res) {
    const users = dbClient.db.collection('users');
    const { email, password } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }
    const existingUser = users.findOne({
      email,
    });

    if (existingUser) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }

    const hashedPassword = hashPassword(password); // removed verified_passowrd which is undefined
    const user = users.insertOne({ email, hashedPassword });

    res.status(200).json({ id: user._id.toString(), email: user.email });
  }
}

module.exports = UsersController;
