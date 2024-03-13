// controllers/FilesController.js
import { ObjectID } from "mongodb";
import dbClient from "../utils/db";
import redisClient from "../utils/redis";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";

const FilesController = {
  async fetchUser(req) {
    const token = req.header("X-Token");
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const userList = dbClient.db.collection("users");
      const userIdObj = new ObjectID(userId);
      const user = await userList.findOne({ _id: userIdObj });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  },
  async getShow(req, res) {
    const { token } = req.params;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
    }
    const userObjID = new ObjectID(userId);

    const file = await dbClient.db
      .collection("files")
      .findOne({ _id: userObjID });

    if (!file) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.status(200).json(file);
  },

  async getIndex(req, res) {
    const token = req.header("X-Token");
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
    }

    const { parentId = "0", page = 0 } = req.query;
    const itemsPerPage = 20;
    const skip = page * itemsPerPage;

    const files = await dbClient.client
      .db(dbClient.database)
      .collection("files")
      .find({ userId, parentId })
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    //return res.status(200).json(files);
    return null;
  },

  async postUpload(req, res) {
    const user = await FilesController.fetchUser(req);
    const { name, type, parentId, data } = req.body;
    const isPublic = req.body.isPublic || false;
    if (!name) {
      return res.status(400).json({ error: "Missing name" });
    }
    if (!type) {
      return res.status(400).json({ error: "Missing type" });
    }
    if (type !== "folder" && !data) {
      return res.status(400).json({ error: "Missing data" });
    }

    const files = await dbClient.db.collection("files");
    if (parentId) {
      const objId = new ObjectID(parentId);
      const file = await files.findOne({ _id: objId, userId: user._id });
      if (!file) {
        return res.status(400).json({ error: "Parent not found" });
      }
      if (file.type != "folder") {
        return res.status(400).json({ error: "Parent is not folder" });
      }
    }
    if (type === "folder") {
      files
        .insertOne({
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic,
        })
        .then((result) =>
          res.status(201).json({
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            parentId: parentId || 0,
            isPublic,
          }),
        )
        .catch((error) => {
          console.log(error);
        });
    } else {
      const tmpFilePath = process.env.FOLDER_PATH || "/tmp/files_manager";
      const filename = `${tmpFilePath}/${uuidv4()}`;
      const buffer = Buffer.from(data, "base64");
      try {
        try {
          await fs.mkdir(tmpFilePath);
        } catch (err) {
          //
        }
        await fs.writeFile(filename, buffer, "utf-8");
      } catch (err) {
        console.log(err);
      }

      files
        .insertOne({
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic,
          localPath: filename,
        })
        .then((result) => {
          res.status(201).json({
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          });
        })
        .catch((error) => {
          console.log(error);
        });
    }
  },
};

module.exports = FilesController;
