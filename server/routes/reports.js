const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, authorize, checkSubscription } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get dashboard analytics
router.get('/dashboard', reportController.getDashboardAnalytics);

// Generate platform report (requires Basic plan or higher)
router.get('/platform', checkSubscription('Basic'), reportController.generatePlatformReport);

// Generate property report (requires Basic plan or higher)
router.get('/properties', checkSubscription('Basic'), reportController.generatePropertyReport);

// Generate lead report (requires Basic plan or higher)
router.get('/leads', checkSubscription('Basic'), reportController.generateLeadReport);

module.exports = router;
