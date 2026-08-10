const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { loginLimiter } = require('../middleware/security');      // DELETE /api/users/:id <-- PERBAIKAN DI SINI


router.get('/users', usersController.getUsers);                // GET    /api/users
router.post('/add-users', usersController.addUser);             // POST   /api/add-users
router.put('/users/:id', usersController.updateUser);           // PUT    /api/users/:id  <-- TAMBAHKAN BARIS INI
router.post('/login', loginLimiter, usersController.login);    // POST   /api/login
router.delete('/users/:id', usersController.deleteUser);        // DELETE /api/users/:id

module.exports = router;