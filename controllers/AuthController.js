// controllers/AuthController.js
import { v4 as uuidv4 } from 'uuid';
import base64url from 'base64url';
import crypto from 'crypto';
import redisClient from '../utils/redis';
import { dbClient } from '../utils/db';

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

    const credentials = base64url.decode(authHeader.slice('Basic '.length));
    const [email, password] = credentials.split(':');
    const hashedPassword = hashPassword(password);

    await dbClient.connect();
    const db = dbClient.client.db(dbClient.database);
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email, password: hashedPassword });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = uuidv4();
    const key = `auth_${token}`;

    await redisClient.set(key, user._id.toString(), 24 * 60 * 60); // 24 hours expiration time

    res.status(200).json({ token });
  },

  async getDisconnect(req, res) {
    const token = req.headers['X-Token'];

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

    await dbClient.connect();
    const db = dbClient.client.db(dbClient.database);

    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: userId });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await usersCollection.deleteOne({ _id: userId });
    await redisClient.del(key);

    res.status(204).send();
  },
};

export default AuthController;
