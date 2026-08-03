const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { loginLimiter } = require('../middleware/security');

router.get('/users', usersController.getUsers);                // GET    /api/users
router.post('/add-users', usersController.addUser);             // POST   /api/add-users
router.post('/login', loginLimiter, usersController.login);    // POST   /api/login
router.delete('/users/:id', usersController.deleteUser);        // DELETE /api/users/:id <-- PERBAIKAN DI SINI

module.exports = router;