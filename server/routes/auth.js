const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.use(protect);

router.get('/me', authController.getMe);
router.put('/profile', authController.updateProfile);
router.put('/change-password', authController.changePassword);
router.post('/api-key', authController.generateApiKey);
router.post('/logout', authController.logout);

module.exports = router;
