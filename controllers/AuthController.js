// controllers/AuthController.js
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { ObjectID } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

/**
 * @param {string} url base64 encoded string
 * @returns {string} decoded base64 string
 */
const base64url = (url) => {
  const buffer = Buffer.from(url, 'base64');
  return buffer.toString('utf-8');
};

const hashPassword = (password) => {
  const sha1 = crypto.createHash('sha1');
  sha1.update(password);
  return sha1.digest('hex');
};

const AuthController = {
  async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const credentials = base64url(authHeader.slice('Basic '.length));
    const [email, password] = credentials.split(':');
    const hashedPassword = hashPassword(password);

    const usersCollection = dbClient.db.collection("users");
    usersCollection.findOne(
      {
        email: email,
        password: hashedPassword,
      },
      //BUG: User is not being found?
      async (err, reply) => {
        if (reply) {
          const token = uuidv4();
          const key = `auth_${token}`;
          await redisClient.set(key, reply._id.toString(), 24 * 60 * 60); // 24 hours expiration time
          res.status(200).json({ token });
        } else {
          res.status(401).json({ error: "Unauthorized" });
        }
      },
    );
  },

  async getDisconnect(req, res) {
    const token = req.header('X-Token');

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const usersCollection = dbClient.db.collection('users');

    const userObjID = new ObjectID(userId);
    const user = await usersCollection.findOne({ _id: userObjID });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await usersCollection.deleteOne({ _id: userObjID });
    await redisClient.del(key);

    res.status(204).send();
  },
};

module.exports = AuthController;
