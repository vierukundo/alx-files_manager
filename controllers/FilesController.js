// controllers/FilesController.js
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';

const FilesController = {
  async getShow(req, res) {
    const { token } = req.params;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.client.db(dbClient.database).collection('files').findOne({ _id: userId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(file);
  },

  async getIndex(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = '0', page = 0 } = req.query;
    const itemsPerPage = 20;
    const skip = page * itemsPerPage;

    const files = await dbClient.client
      .db(dbClient.database)
      .collection('files')
      .find({ userId, parentId })
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    return res.status(200).json(files);
  },
};

export default FilesController;
