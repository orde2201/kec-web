const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/add-users', userController.addUser);
router.get('/users', userController.getAllUsers);

module.exports = router;