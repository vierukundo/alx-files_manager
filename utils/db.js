import { MongoClient } from 'mongodb';

const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || 27017;
const DB_NAME = process.env.DB_DATABASE || 'files_manager';
const dbUrl = `mongodb://${HOST}:${PORT}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(dbUrl, { useUnifiedTopology: true });

    // Make the constructor asynchronous
    (async () => {
      try {
        await this.client.connect();
        this.db = this.client.db(`${DB_NAME}`);
        console.log('Connected to MongoDB');
      } catch (err) {
        console.error('Error connecting to MongoDB:', err);
      }
    })();
  }

  /**
   * Checks if connection to MongoDB is active
   * @returns {boolean} connection status
   */
  isAlive() {
    return this.client.isConnected();
  }

  /**
   * Count number of users in collection `users`
   * @returns {number} Number of users
   */
  async nbUsers() {
    const collection = this.db.collection('users');
    const numberOfUsers = await collection.countDocuments();
    return numberOfUsers;
  }

  /**
   * Count number of files in collection `files`
   * @returns {number} Number of files
   */
  async nbFiles() {
    const collection = this.db.collection('files');
    const numberOfFiles = await collection.countDocuments();
    return numberOfFiles;
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
