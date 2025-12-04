const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

//console.log('[DEBUG] User routes loaded');

router.post('/register', (req, res, next) => {
    //console.log('[DEBUG] Route /register hit');
    next();
}, userController.register);

router.post('/login', (req, res, next) => {
    //console.log('[DEBUG] Route /login hit');
    next();
}, userController.login);

module.exports = router;