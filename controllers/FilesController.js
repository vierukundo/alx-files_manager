// controllers/FilesController.js
import { ObjectID } from "mongodb";
import dbClient from "../utils/db";
import mime from "mime-types";
import redisClient from "../utils/redis";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";
import Queue from "bull";
const fileQueue = new Queue("fileQueue", "redis://127.0.0.1:6379");

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
    const user = await FilesController.fetchUser(req);

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
    }
    const objId = new ObjectID(req.params.id);

    const file = await dbClient.db
      .collection("files")
      .findOne({ _id: objId, userId: user._id });

    if (!file) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.status(200).json(file);
  },

  async putPublish(req, res) {
    const user = await FilesController.fetchUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { id } = req.params;
    const files = dbClient.db.collection("files");
    const objId = new ObjectID(id);
    const isPublic = { $set: { isPublic: true } };
    const opts = { returnOriginal: false };
    files.findOneAndUpdate(
      { _id: objId, userId: user._id },
      isPublic,
      opts,
      (err, result) => {
        if (!result.lastErrorObject.updatedExisting) {
          return res.status(404).json({ error: "Not found" });
        }
        return res.status(200).json(result.value);
      },
    );
    return null;
  },

  async putUnpublish(req, res) {
    const user = await FilesController.fetchUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { id } = req.params;
    const files = dbClient.db.collection("files");
    const objId = new ObjectID(id);
    const isPublic = { $set: { isPublic: false } };
    const opts = { returnOriginal: false };
    files.findOneAndUpdate(
      { _id: objId, userId: user._id },
      isPublic,
      opts,
      (err, result) => {
        if (!result.lastErrorObject.updatedExisting) {
          return res.status(404).json({ error: "Not found" });
        }
        return res.status(200).json(result.value);
      },
    );
    return null;
  },

  async getIndex(req, res) {
    const user = await FilesController.fetchUser(req);

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
    }

    const { parentId, page } = req.query;
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
          if (type === "image") {
            fileQueue.add({ userId: user._id, fileId: result.insertedId });
          }
        })
        .catch((error) => {
          console.log(error);
        });
    }
  },

  async getFile(req, res) {
    const { id } = req.params;
    const files = dbClient.db.collection("files");
    const objId = new ObjectID(id);
    files.findOne({ _id: objId }, async (err, file) => {
      if (!file) {
        return res.status(404).json({ error: "Not found" });
      }
      if (file.isPublic) {
        if (file.type === "folder") {
          return res
            .status(400)
            .json({ error: "A folder doesn't have content" });
        }
        try {
          let filename = file.localPath;
          const { size } = req.params;
          if (size) {
            filename = `${file.localPath}_${size}`;
          }
          const data = await fs.readFile(filename);
          const contentType = mime.contentType(file.name);
          return res.header("Content-Type", contentType).status(200).send(data);
        } catch (err) {
          return res.status(404).json({ error: "Not found" });
        }
      } else {
        const user = await FilesController.fetchUser(req);
        if (!user) {
          return res.status(404).json({ error: "Not found" });
        }
        if (file.userId.toString() === user._id.toString()) {
          if (file.type === "folder") {
            return res
              .status(400)
              .json({ error: "A folder doesn't have content" });
          }
          try {
            let filename = file.localPath;
            const { size } = req.params;
            if (size) {
              filename = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name);
            return res
              .header("Content-Type", contentType)
              .status(200)
              .sendFile(filename);
          } catch (err) {
            return res.status(404).json({ error: "Not found" });
          }
        } else {
          return res.status(400).json({ error: "Not found" });
        }
      }
    });
  },
};

module.exports = FilesController;
