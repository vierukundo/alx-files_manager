// controllers/UsersController.js
import redisClient from '../utils/redis';
import { dbClient } from '../utils/db';

const UsersController = {
  async getMe(req, res) {
    const token = req.headers['X-Token'];

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = await redisClient.get(`auth_${token}`);

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

    res.status(200).json({ id: user._id.toString(), email: user.email });
  },
};

export default UsersController;
