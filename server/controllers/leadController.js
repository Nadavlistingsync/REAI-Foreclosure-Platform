const Lead = require('../models/Lead');
const Property = require('../models/Property');
const User = require('../models/User');
const logger = require('../utils/logger');

class LeadController {
  // Get all leads with filtering and pagination
  async getLeads(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        assignedTo,
        source,
        minScore,
        maxScore,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = req.query;

      // Build filter object
      const filter = { isActive: true };
      
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (assignedTo) filter.assignedTo = assignedTo;
      if (source) filter.source = source;
      if (minScore || maxScore) {
        filter['score.total'] = {};
        if (minScore) filter['score.total'].$gte = parseInt(minScore);
        if (maxScore) filter['score.total'].$lte = parseInt(maxScore);
      }
      
      if (search) {
        filter.$or = [
          { 'contact.name': new RegExp(search, 'i') },
          { 'contact.phone': new RegExp(search, 'i') },
          { 'contact.email': new RegExp(search, 'i') }
        ];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const leads = await Lead.find(filter)
        .populate('property', 'address foreclosureDetails financials')
        .populate('assignedTo', 'firstName lastName email phone')
        .populate('communications.author', 'firstName lastName')
        .populate('createdBy', 'firstName lastName')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Lead.countDocuments(filter);

      res.json({
        success: true,
        data: leads,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } catch (error) {
      logger.error('Error getting leads:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get single lead by ID
  async getLead(req, res) {
    try {
      const lead = await Lead.findById(req.params.id)
        .populate('property')
        .populate('assignedTo', 'firstName lastName email phone')
        .populate('communications.author', 'firstName lastName')
        .populate('createdBy', 'firstName lastName');

      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      res.json({ success: true, data: lead });
    } catch (error) {
      logger.error('Error getting lead:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Create new lead
  async createLead(req, res) {
    try {
      const leadData = {
        ...req.body,
        createdBy: req.user._id,
        updatedBy: req.user._id
      };

      const lead = await Lead.create(leadData);

      res.status(201).json({ success: true, data: lead });
    } catch (error) {
      logger.error('Error creating lead:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update lead
  async updateLead(req, res) {
    try {
      const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
      );

      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      res.json({ success: true, data: lead });
    } catch (error) {
      logger.error('Error updating lead:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Delete lead (soft delete)
  async deleteLead(req, res) {
    try {
      const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        { isActive: false, updatedBy: req.user._id },
        { new: true }
      );

      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
      logger.error('Error deleting lead:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Add communication to lead
  async addCommunication(req, res) {
    try {
      const { type, direction, content, subject, duration, outcome, nextAction } = req.body;

      const lead = await Lead.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      const communication = {
        type,
        direction,
        content,
        subject,
        duration,
        outcome,
        nextAction,
        author: req.user._id
      };

      await lead.addCommunication(communication);

      res.json({ success: true, data: lead });
    } catch (error) {
      logger.error('Error adding communication:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update lead status
  async updateStatus(req, res) {
    try {
      const { status } = req.body;

      const lead = await Lead.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      await lead.updateStatus(status, req.user._id);

      res.json({ success: true, data: lead });
    } catch (error) {
      logger.error('Error updating lead status:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Assign lead to user
  async assignLead(req, res) {
    try {
      const { assignedTo } = req.body;

      const lead = await Lead.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      await lead.assignTo(assignedTo);

      res.json({ success: true, data: lead });
    } catch (error) {
      logger.error('Error assigning lead:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get lead analytics
  async getLeadAnalytics(req, res) {
    try {
      const {
        timeRange = '30d',
        assignedTo,
        source
      } = req.query;

      // Calculate date range
      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

      // Build filter
      const filter = {
        isActive: true,
        createdAt: { $gte: startDate }
      };
      
      if (assignedTo) filter.assignedTo = assignedTo;
      if (source) filter.source = source;

      // Get analytics data
      const [
        totalLeads,
        statusBreakdown,
        priorityBreakdown,
        sourceBreakdown,
        averageScore,
        conversionRate,
        topLeads
      ] = await Promise.all([
        Lead.countDocuments(filter),
        Lead.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Lead.aggregate([
          { $match: filter },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        Lead.aggregate([
          { $match: filter },
          { $group: { _id: '$source', count: { $sum: 1 } } }
        ]),
        Lead.aggregate([
          { $match: filter },
          { $group: { _id: null, avgScore: { $avg: '$score.total' } } }
        ]),
        Lead.aggregate([
          { $match: { ...filter, isConverted: true } },
          { $count: 'converted' }
        ]),
        Lead.find(filter)
          .sort({ 'score.total': -1 })
          .limit(5)
          .populate('property', 'address')
          .populate('assignedTo', 'firstName lastName')
      ]);

      const totalConverted = conversionRate[0]?.converted || 0;
      const conversionPercentage = totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0;

      res.json({
        success: true,
        data: {
          totalLeads,
          statusBreakdown,
          priorityBreakdown,
          sourceBreakdown,
          averageScore: averageScore[0]?.avgScore || 0,
          conversionRate: conversionPercentage,
          topLeads
        }
      });
    } catch (error) {
      logger.error('Error getting lead analytics:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Bulk update leads
  async bulkUpdateLeads(req, res) {
    try {
      const { leadIds, updates } = req.body;

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Lead IDs are required' });
      }

      const result = await Lead.updateMany(
        { _id: { $in: leadIds } },
        { ...updates, updatedBy: req.user._id }
      );

      res.json({
        success: true,
        message: `Updated ${result.modifiedCount} leads`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      logger.error('Error bulk updating leads:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get follow-up tasks
  async getFollowUpTasks(req, res) {
    try {
      const { assignedTo } = req.query;

      const filter = {
        isActive: true,
        'followUp.nextActionDate': { $lte: new Date() },
        status: { $nin: ['Closed', 'Lost'] }
      };

      if (assignedTo) filter.assignedTo = assignedTo;

      const leads = await Lead.find(filter)
        .populate('property', 'address foreclosureDetails')
        .populate('assignedTo', 'firstName lastName email')
        .sort({ 'followUp.nextActionDate': 1 });

      res.json({ success: true, data: leads });
    } catch (error) {
      logger.error('Error getting follow-up tasks:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Export leads
  async exportLeads(req, res) {
    try {
      const { format = 'csv', ...filters } = req.query;

      // Build filter object
      const filter = { isActive: true };
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          if (key === 'status') filter.status = filters[key];
          else if (key === 'priority') filter.priority = filters[key];
          else if (key === 'source') filter.source = filters[key];
        }
      });

      const leads = await Lead.find(filter)
        .populate('property', 'address foreclosureDetails')
        .populate('assignedTo', 'firstName lastName email')
        .select('-__v -createdAt -updatedAt');

      if (format === 'csv') {
        const csv = this.convertToCSV(leads);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
        res.send(csv);
      } else {
        res.json({ success: true, data: leads });
      }
    } catch (error) {
      logger.error('Error exporting leads:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Convert leads to CSV
  convertToCSV(leads) {
    const headers = [
      'Lead ID',
      'Contact Name',
      'Phone',
      'Email',
      'Property Address',
      'Source',
      'Status',
      'Priority',
      'Score',
      'Assigned To',
      'Created Date'
    ];

    const rows = leads.map(lead => [
      lead.leadId,
      lead.contact.name,
      lead.contact.phone || '',
      lead.contact.email || '',
      lead.property ? `${lead.property.address.street}, ${lead.property.address.city}` : '',
      lead.source,
      lead.status,
      lead.priority,
      lead.score.total,
      lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '',
      lead.createdAt.toISOString().split('T')[0]
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = new LeadController();
