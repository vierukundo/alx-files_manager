// routes/index.js
const express = require("express");
const AppController = require("../controllers/AppController");
const AuthController = require("../controllers/AuthController");
const UsersController = require("../controllers/UsersController");
const FilesController = require("../controllers/FilesController");
const router = express.Router();

router.get("/status", AppController.getStatus);
router.get("/stats", AppController.getStats);
router.get("/connect", AuthController.getConnect);
router.get("/disconnect", AuthController.getDisconnect);
router.get("/users/me", UsersController.getMe);
//router.get("/files/:id", FilesController.getShow);
router.get("/files", FilesController.getIndex);
router.post("/files", FilesController.postUpload);
router.post("/users", UsersController.postNew);

module.exports = router;
