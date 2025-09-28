const Property = require('../models/Property');
const Lead = require('../models/Lead');
const Analysis = require('../models/Analysis');
const logger = require('../utils/logger');
const DataProcessor = require('../services/dataCollection/dataProcessor');

class PropertyController {
  // Get all properties with filtering and pagination
  async getProperties(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        assignedTo,
        county,
        state,
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = req.query;

      // Build filter object
      const filter = { isActive: true };
      
      if (status) filter['leadInfo.status'] = status;
      if (priority) filter['leadInfo.priority'] = priority;
      if (assignedTo) filter['leadInfo.assignedTo'] = assignedTo;
      if (county) filter['address.county'] = new RegExp(county, 'i');
      if (state) filter['address.state'] = new RegExp(state, 'i');
      if (minPrice || maxPrice) {
        filter['foreclosureDetails.openingBid'] = {};
        if (minPrice) filter['foreclosureDetails.openingBid'].$gte = parseInt(minPrice);
        if (maxPrice) filter['foreclosureDetails.openingBid'].$lte = parseInt(maxPrice);
      }
      
      if (search) {
        filter.$or = [
          { 'address.street': new RegExp(search, 'i') },
          { 'address.city': new RegExp(search, 'i') },
          { 'owner.name': new RegExp(search, 'i') }
        ];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const properties = await Property.find(filter)
        .populate('leadInfo.assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Property.countDocuments(filter);

      res.json({
        success: true,
        data: properties,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } catch (error) {
      logger.error('Error getting properties:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get single property by ID
  async getProperty(req, res) {
    try {
      const property = await Property.findById(req.params.id)
        .populate('leadInfo.assignedTo', 'firstName lastName email phone')
        .populate('leadInfo.notes.author', 'firstName lastName')
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');

      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      res.json({ success: true, data: property });
    } catch (error) {
      logger.error('Error getting property:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Create new property
  async createProperty(req, res) {
    try {
      const propertyData = {
        ...req.body,
        createdBy: req.user._id,
        updatedBy: req.user._id
      };

      const property = await Property.create(propertyData);
      
      // Generate lead for the property
      const dataProcessor = new DataProcessor();
      await dataProcessor.generateLead(property);

      res.status(201).json({ success: true, data: property });
    } catch (error) {
      logger.error('Error creating property:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update property
  async updateProperty(req, res) {
    try {
      const property = await Property.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
      );

      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      res.json({ success: true, data: property });
    } catch (error) {
      logger.error('Error updating property:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Delete property (soft delete)
  async deleteProperty(req, res) {
    try {
      const property = await Property.findByIdAndUpdate(
        req.params.id,
        { isActive: false, updatedBy: req.user._id },
        { new: true }
      );

      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      res.json({ success: true, message: 'Property deleted successfully' });
    } catch (error) {
      logger.error('Error deleting property:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Enrich property data
  async enrichProperty(req, res) {
    try {
      const property = await Property.findById(req.params.id);
      
      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      const dataProcessor = new DataProcessor();
      const enrichedProperty = await dataProcessor.enrichPropertyData(property);

      res.json({ success: true, data: enrichedProperty });
    } catch (error) {
      logger.error('Error enriching property:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get property analytics
  async getPropertyAnalytics(req, res) {
    try {
      const {
        timeRange = '30d',
        county,
        state,
        status
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
      
      if (county) filter['address.county'] = new RegExp(county, 'i');
      if (state) filter['address.state'] = new RegExp(state, 'i');
      if (status) filter['leadInfo.status'] = status;

      // Get analytics data
      const [
        totalProperties,
        statusBreakdown,
        priorityBreakdown,
        countyBreakdown,
        averageScore,
        topProperties
      ] = await Promise.all([
        Property.countDocuments(filter),
        Property.aggregate([
          { $match: filter },
          { $group: { _id: '$leadInfo.status', count: { $sum: 1 } } }
        ]),
        Property.aggregate([
          { $match: filter },
          { $group: { _id: '$leadInfo.priority', count: { $sum: 1 } } }
        ]),
        Property.aggregate([
          { $match: filter },
          { $group: { _id: '$address.county', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        Property.aggregate([
          { $match: filter },
          { $group: { _id: null, avgScore: { $avg: '$dataQuality.completeness' } } }
        ]),
        Property.find(filter)
          .sort({ 'dataQuality.completeness': -1 })
          .limit(5)
          .select('address foreclosureDetails dataQuality')
      ]);

      res.json({
        success: true,
        data: {
          totalProperties,
          statusBreakdown,
          priorityBreakdown,
          countyBreakdown,
          averageScore: averageScore[0]?.avgScore || 0,
          topProperties
        }
      });
    } catch (error) {
      logger.error('Error getting property analytics:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Bulk update properties
  async bulkUpdateProperties(req, res) {
    try {
      const { propertyIds, updates } = req.body;

      if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Property IDs are required' });
      }

      const result = await Property.updateMany(
        { _id: { $in: propertyIds } },
        { ...updates, updatedBy: req.user._id }
      );

      res.json({
        success: true,
        message: `Updated ${result.modifiedCount} properties`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      logger.error('Error bulk updating properties:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get property map data
  async getPropertyMapData(req, res) {
    try {
      const { bounds, status, priority } = req.query;

      const filter = { isActive: true };
      
      if (status) filter['leadInfo.status'] = status;
      if (priority) filter['leadInfo.priority'] = priority;

      // If bounds are provided, filter by coordinates
      if (bounds) {
        const { north, south, east, west } = JSON.parse(bounds);
        filter['address.coordinates.lat'] = { $gte: south, $lte: north };
        filter['address.coordinates.lng'] = { $gte: west, $lte: east };
      }

      const properties = await Property.find(filter)
        .select('address foreclosureDetails leadInfo dataQuality')
        .limit(1000); // Limit for performance

      res.json({ success: true, data: properties });
    } catch (error) {
      logger.error('Error getting property map data:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Export properties
  async exportProperties(req, res) {
    try {
      const { format = 'csv', ...filters } = req.query;

      // Build filter object (similar to getProperties)
      const filter = { isActive: true };
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          if (key === 'status') filter['leadInfo.status'] = filters[key];
          else if (key === 'priority') filter['leadInfo.priority'] = filters[key];
          else if (key === 'county') filter['address.county'] = new RegExp(filters[key], 'i');
          else if (key === 'state') filter['address.state'] = new RegExp(filters[key], 'i');
        }
      });

      const properties = await Property.find(filter)
        .populate('leadInfo.assignedTo', 'firstName lastName email')
        .select('-__v -createdAt -updatedAt');

      if (format === 'csv') {
        const csv = this.convertToCSV(properties);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=properties.csv');
        res.send(csv);
      } else {
        res.json({ success: true, data: properties });
      }
    } catch (error) {
      logger.error('Error exporting properties:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Convert properties to CSV
  convertToCSV(properties) {
    const headers = [
      'Address',
      'City',
      'State',
      'Zip Code',
      'Property Type',
      'Foreclosure Status',
      'Opening Bid',
      'Auction Date',
      'Owner Name',
      'Lead Status',
      'Priority',
      'Assigned To',
      'Data Quality'
    ];

    const rows = properties.map(property => [
      property.address.street,
      property.address.city,
      property.address.state,
      property.address.zipCode,
      property.propertyType,
      property.foreclosureStatus,
      property.foreclosureDetails.openingBid,
      property.foreclosureDetails.auctionDate,
      property.owner.name,
      property.leadInfo.status,
      property.leadInfo.priority,
      property.leadInfo.assignedTo ? `${property.leadInfo.assignedTo.firstName} ${property.leadInfo.assignedTo.lastName}` : '',
      property.dataQuality.completeness
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = new PropertyController();
