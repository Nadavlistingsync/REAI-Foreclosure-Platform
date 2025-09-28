const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { protect, authorize, checkSubscription } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get automation status
router.get('/status', automationController.getAutomationStatus);

// Get automation analytics
router.get('/analytics', automationController.getAutomationAnalytics);

// Get workflows
router.get('/workflows', automationController.getWorkflows);

// Create new workflow (requires Professional plan or higher)
router.post('/workflows', checkSubscription('Professional'), automationController.createWorkflow);

// Execute workflow
router.post('/workflows/execute', checkSubscription('Professional'), automationController.executeWorkflow);

// Trigger data collection (Admin only)
router.post('/data-collection', authorize('Admin'), automationController.triggerDataCollection);

// Send email notification
router.post('/notifications/email', checkSubscription('Basic'), automationController.sendEmailNotification);

// Send SMS notification
router.post('/notifications/sms', checkSubscription('Basic'), automationController.sendSMSNotification);

module.exports = router;
