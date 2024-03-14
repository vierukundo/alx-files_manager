// controllers/UsersController.js
import { ObjectID } from "mongodb";
import crypto from "crypto";
import redisClient from "../utils/redis";
import dbClient from "../utils/db";

/**
 * @param {string} password password to hash
 * @returns {string} hashed passwqord
 */
const hashPassword = (password) => {
  const sha1 = crypto.createHash("sha1");
  sha1.update(password);
  return sha1.digest("hex");
};

class UsersController {
  /**
   * @param {Request} req Express Request
   * @param {Response} res Express Response
   * @returns {JSON} json response
   */
  static async getMe(req, res) {
    const token = req.header("X-Token");

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userObjID = new ObjectID(userId);
    const usersCollection = dbClient.db.collection("users");
    const user = await usersCollection.findOne({ _id: userObjID });

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.status(200).json({ id: user._id.toString(), email: user.email });
  }

  /** Post new user
   * @param {Request} req
   * @param {Response} res
   * @returns `json` of user_id & email
   */
  static async postNew(req, res) {
    await dbClient.client.connect();
    const db = dbClient.client.db(dbClient.database);
    const users = db.collection("users");
    const { email, password } = req.body;
    if (!email) {
      res.status(400).json({ error: "Missing email" });
      return;
    }

    if (!password) {
      res.status(400).json({ error: "Missing password" });
      return;
    }
    users.findOne(
      {
        email,
      },
      (err, doesExist) => {
        if (doesExist) {
          res.status(400).json({ error: "Already exist" });
        } else {
          const hashedPassword = hashPassword(password);
          users
            .insertOne({ email, password: hashedPassword })
            .then((result) => {
              res.status(201).json({ id: result.insertedId, email });
            })
            .catch((err) => console.log(err));
        }
      },
    );
  }
}

module.exports = UsersController;
