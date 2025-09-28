const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize, checkSubscription } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get all users (Admin only)
router.get('/', authorize('Admin'), userController.getUsers);

// Get user analytics (Admin only)
router.get('/analytics', authorize('Admin'), userController.getUserAnalytics);

// Export users (Admin only)
router.get('/export', authorize('Admin'), userController.exportUsers);

// Get single user
router.get('/:id', userController.getUser);

// Update user
router.put('/:id', userController.updateUser);

// Delete user (Admin only)
router.delete('/:id', authorize('Admin'), userController.deleteUser);

// Update user subscription (Admin only)
router.patch('/:id/subscription', authorize('Admin'), userController.updateSubscription);

// Generate API key
router.post('/:id/api-key', userController.generateApiKey);

// Bulk update users (Admin only)
router.patch('/bulk', authorize('Admin'), userController.bulkUpdateUsers);

module.exports = router;
