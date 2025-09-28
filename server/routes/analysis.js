const express = require('express');
const router = express.Router();
const { protect, checkSubscription } = require('../middleware/auth');

// Placeholder for analysis controller
const analysisController = {
  getAnalyses: async (req, res) => {
    res.json({ success: true, message: 'Analysis endpoint - to be implemented' });
  },
  createAnalysis: async (req, res) => {
    res.json({ success: true, message: 'Create analysis endpoint - to be implemented' });
  }
};

// All routes are protected
router.use(protect);

// Get all analyses
router.get('/', analysisController.getAnalyses);

// Create new analysis (requires Basic plan or higher)
router.post('/', checkSubscription('Basic'), analysisController.createAnalysis);

module.exports = router;
