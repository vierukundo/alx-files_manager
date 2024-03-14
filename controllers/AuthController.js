import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { ObjectID } from "mongodb";
import redisClient from "../utils/redis";
import dbClient from "../utils/db";

const base64url = (url) => {
  const buffer = Buffer.from(url, "base64");
  return buffer.toString("utf-8");
};

const hashPassword = (password) => {
  const sha1 = crypto.createHash("sha1");
  sha1.update(password);
  return sha1.digest("hex");
};

const AuthController = {
  async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let credentials;
    try {
      credentials = base64url(authHeader.slice("Basic ".length));
    } catch (err) {
      res.status(401).json({ error: "Unauthorized" });
    }

    if (!credentials.includes(":")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [email, password] = credentials.split(":");
    const hashedPassword = hashPassword(password);

    const usersCollection = dbClient.db.collection("users");
    const user = await usersCollection.findOne({
      email,
      password: hashedPassword,
    });
    if (user) {
      const token = uuidv4();
      const key = `auth_${token}`;
      redisClient
        .set(key, user._id.toString(), 24 * 60 * 60)
        .then(() => {
          res.status(200).json({ token });
        })
        .catch(() => {
          res.status(401).json({ error: "Unauthorized" });
        });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  },

  async getDisconnect(req, res) {
    const token = req.header("X-Token");

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const key = `auth_${token}`;
    redisClient
      .get(key)
      .then((userId) => {
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const usersCollection = dbClient.db.collection("users");

        const userObjID = new ObjectID(userId);
        usersCollection
          .findOne({ _id: userObjID })
          .then((user) => {
            if (!user) {
              res.status(401).json({ error: "Unauthorized" });
              return;
            }

            redisClient
              .del(key)
              .then(() => {
                res.status(204).send();
              })
              .catch(() => {
                res.status(401).json({ error: "Unauthorized" });
              });
          })
          .catch(() => {
            res.status(401).json({ error: "Unauthorized" });
          });
      })
      .catch(() => {
        res.status(401).json({ error: "Unauthorized" });
      });
  },
};

module.exports = AuthController;
