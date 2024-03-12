// controllers/UsersController.js
import redisClient from "../utils/redis";
import { ObjectID } from "mongodb";
import dbClient from "../utils/db";
const hash_pass = require("sha1");

class UsersController {
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
  //TODO: Comeback and finish this function
  /** Post new user
   * @param {Request} req
   * @param {Response} res
   * @returns `json` of user_id & email
   */
  static postNew(req, res) {
    const users = dbClient.db.collection("users");
    const { email, password } = req.body;
    if (email.length === 0) {
      res.status(400).json({ error: "Missing email" });
      return;
    }

    if (password.length === 0) {
      res.status(400).json({ error: "Missing password" });
      return;
    }
    const existingUser = users.findOne({
      email: email,
    });

    if (existingUser) {
      res.status(400).json({ error: "Already exist" });
      return;
    }

    const hashed_password = hash_pass(verified_password);
    const user = users.insertOne({ email, hashed_password });

    res.status(200).json({ id: user._id.toString(), email: user.email });
  }
}

module.exports = UsersController;