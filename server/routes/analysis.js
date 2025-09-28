const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const { protect, authorize, checkSubscription } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get all analyses
router.get('/', analysisController.getAnalyses);

// Get analysis analytics
router.get('/analytics', analysisController.getAnalysisAnalytics);

// Get single analysis
router.get('/:id', analysisController.getAnalysis);

// Create new analysis (requires Basic plan or higher)
router.post('/', checkSubscription('Basic'), analysisController.createAnalysis);

// Update analysis
router.put('/:id', analysisController.updateAnalysis);

// Delete analysis
router.delete('/:id', analysisController.deleteAnalysis);

// Calculate flip analysis
router.post('/calculate/flip', checkSubscription('Basic'), analysisController.calculateFlipAnalysis);

// Calculate rental analysis
router.post('/calculate/rental', checkSubscription('Basic'), analysisController.calculateRentalAnalysis);

// Calculate wholesale analysis
router.post('/calculate/wholesale', checkSubscription('Basic'), analysisController.calculateWholesaleAnalysis);

// Update repair status
router.patch('/:id/repairs', analysisController.updateRepairStatus);

module.exports = router;
