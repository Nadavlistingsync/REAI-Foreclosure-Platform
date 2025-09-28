const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { protect, authorize, checkSubscription } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get all properties
router.get('/', propertyController.getProperties);

// Get property analytics
router.get('/analytics', propertyController.getPropertyAnalytics);

// Get property map data
router.get('/map', propertyController.getPropertyMapData);

// Export properties
router.get('/export', propertyController.exportProperties);

// Get single property
router.get('/:id', propertyController.getProperty);

// Create new property (requires Professional plan or higher)
router.post('/', checkSubscription('Professional'), propertyController.createProperty);

// Update property
router.put('/:id', propertyController.updateProperty);

// Delete property (soft delete)
router.delete('/:id', authorize('Admin', 'Manager'), propertyController.deleteProperty);

// Enrich property data
router.post('/:id/enrich', checkSubscription('Basic'), propertyController.enrichProperty);

// Bulk update properties
router.patch('/bulk', authorize('Admin', 'Manager'), propertyController.bulkUpdateProperties);

module.exports = router;
