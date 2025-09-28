const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { protect, authorize, checkSubscription } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get all leads
router.get('/', leadController.getLeads);

// Get lead analytics
router.get('/analytics', leadController.getLeadAnalytics);

// Get follow-up tasks
router.get('/follow-up', leadController.getFollowUpTasks);

// Export leads
router.get('/export', leadController.exportLeads);

// Get single lead
router.get('/:id', leadController.getLead);

// Create new lead
router.post('/', leadController.createLead);

// Update lead
router.put('/:id', leadController.updateLead);

// Delete lead (soft delete)
router.delete('/:id', authorize('Admin', 'Manager'), leadController.deleteLead);

// Add communication to lead
router.post('/:id/communication', leadController.addCommunication);

// Update lead status
router.patch('/:id/status', leadController.updateStatus);

// Assign lead to user
router.patch('/:id/assign', leadController.assignLead);

// Bulk update leads
router.patch('/bulk', authorize('Admin', 'Manager'), leadController.bulkUpdateLeads);

module.exports = router;
