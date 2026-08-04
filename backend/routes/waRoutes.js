const express = require('express');
const router = express.Router();
const waController = require('../controllers/waController');

// Route Endpoint WhatsApp
router.get('/status', waController.getWaStatus);
router.post('/logout', waController.logoutWa);

module.exports = router;