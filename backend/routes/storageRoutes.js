const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');

router.get('/', storageController.getStorageStats);

module.exports = router;
