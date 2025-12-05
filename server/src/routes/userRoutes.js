const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
router.post('/register', (req, res, next) => {
    next();
}, userController.register);

router.post('/login', (req, res, next) => {
    next();
}, userController.login);

module.exports = router;