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
    const user = await FilesController.fetchUser(req);

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
    }

    const { parentId, page } = req.query;
    const itemsPerPage = 20;
    const skip = page * itemsPerPage;
    let queryBuilder;
    const pager = page || 0;
    const files = dbClient.db.collection("files");
    if (!parentId) {
      queryBuilder = { userId: user._id };
    } else {
      queryBuilder = { userId: user._id, parentId: ObjectID(parentId) };
    }
    files
      .aggregate([
        { $match: queryBuilder },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [
              { $count: "total" },
              { $addFields: { page: parseInt(pager, 10) } },
            ],
            data: [{ $skip: 20 * parseInt(pager, 10) }, { $limit: 20 }],
          },
        },
      ])
      .toArray((err, result) => {
        if (result) {
          const filtered = result[0].data.map((mongoFile) => {
            const tmpFile = {
              ...mongoFile,
              id: mongoFile._id,
            };
            delete tmpFile._id;
            delete tmpFile.localPath;
            return tmpFile;
          });
          return res.status(200).json(filtered);
        }

        return res.status(400).json({ error: "Not found" });
      });
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
