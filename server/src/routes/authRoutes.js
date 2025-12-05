const express = require('express');
const router = express.Router();
const shopifyController = require('../controllers/shopifyController');
const { authenticateToken } = require('../utils/auth');

router.get('/install', authenticateToken, shopifyController.install);
router.get('/callback', shopifyController.callback);
router.post('/disconnect', authenticateToken, shopifyController.disconnect);

module.exports = router;