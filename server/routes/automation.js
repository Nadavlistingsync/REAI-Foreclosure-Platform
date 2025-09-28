const express = require('express');
const router = express.Router();
const { protect, authorize, checkSubscription } = require('../middleware/auth');

// Placeholder for automation controller
const automationController = {
  getAutomations: async (req, res) => {
    res.json({ success: true, message: 'Automation endpoint - to be implemented' });
  },
  createAutomation: async (req, res) => {
    res.json({ success: true, message: 'Create automation endpoint - to be implemented' });
  },
  triggerDataCollection: async (req, res) => {
    res.json({ success: true, message: 'Data collection triggered' });
  }
};

// All routes are protected
router.use(protect);

// Get all automations
router.get('/', automationController.getAutomations);

// Create new automation (requires Professional plan or higher)
router.post('/', checkSubscription('Professional'), automationController.createAutomation);

// Trigger data collection (Admin only)
router.post('/data-collection', authorize('Admin'), automationController.triggerDataCollection);

module.exports = router;
