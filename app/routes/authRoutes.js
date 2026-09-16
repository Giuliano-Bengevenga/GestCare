const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get(['/login', '/login/'], authController.showLogin);
router.post(['/login', '/login/'], authController.login);
router.get(['/logout', '/logout/'], authController.logout);

module.exports = router;
