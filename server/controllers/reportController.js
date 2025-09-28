const Property = require('../models/Property');
const Lead = require('../models/Lead');
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const logger = require('../utils/logger');

class ReportController {
  // Generate comprehensive platform report
  async generatePlatformReport(req, res) {
    try {
      const { 
        startDate, 
        endDate, 
        includeCharts = true,
        format = 'json'
      } = req.query;

      // Set date range
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Build date filter
      const dateFilter = {
        createdAt: { $gte: start, $lte: end }
      };

      // Get comprehensive data
      const [
        propertyStats,
        leadStats,
        userStats,
        analysisStats,
        topProperties,
        topLeads,
        conversionMetrics,
        marketTrends
      ] = await Promise.all([
        this.getPropertyStats(dateFilter),
        this.getLeadStats(dateFilter),
        this.getUserStats(dateFilter),
        this.getAnalysisStats(dateFilter),
        this.getTopProperties(dateFilter),
        this.getTopLeads(dateFilter),
        this.getConversionMetrics(dateFilter),
        this.getMarketTrends(dateFilter)
      ]);

      const report = {
        reportInfo: {
          generatedAt: new Date().toISOString(),
          generatedBy: req.user._id,
          dateRange: { start, end },
          format
        },
        summary: {
          totalProperties: propertyStats.total,
          totalLeads: leadStats.total,
          totalUsers: userStats.total,
          totalAnalyses: analysisStats.total,
          conversionRate: conversionMetrics.overallConversionRate,
          averageDealSize: conversionMetrics.averageDealSize
        },
        propertyMetrics: propertyStats,
        leadMetrics: leadStats,
        userMetrics: userStats,
        analysisMetrics: analysisStats,
        topPerformers: {
          properties: topProperties,
          leads: topLeads
        },
        conversionMetrics,
        marketTrends,
        charts: includeCharts ? await this.generateChartData(dateFilter) : null
      };

      if (format === 'csv') {
        const csv = this.convertReportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=platform-report.csv');
        res.send(csv);
      } else {
        res.json({ success: true, data: report });
      }
    } catch (error) {
      logger.error('Error generating platform report:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Generate property performance report
  async generatePropertyReport(req, res) {
    try {
      const { 
        startDate, 
        endDate, 
        county,
        state,
        status,
        format = 'json'
      } = req.query;

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const filter = {
        createdAt: { $gte: start, $lte: end },
        isActive: true
      };

      if (county) filter['address.county'] = new RegExp(county, 'i');
      if (state) filter['address.state'] = new RegExp(state, 'i');
      if (status) filter['leadInfo.status'] = status;

      const [
        properties,
        statusBreakdown,
        countyBreakdown,
        priorityBreakdown,
        averageValues,
        dataQualityMetrics
      ] = await Promise.all([
        Property.find(filter).populate('leadInfo.assignedTo', 'firstName lastName'),
        Property.aggregate([
          { $match: filter },
          { $group: { _id: '$leadInfo.status', count: { $sum: 1 } } }
        ]),
        Property.aggregate([
          { $match: filter },
          { $group: { _id: '$address.county', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        Property.aggregate([
          { $match: filter },
          { $group: { _id: '$leadInfo.priority', count: { $sum: 1 } } }
        ]),
        Property.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              avgOpeningBid: { $avg: '$foreclosureDetails.openingBid' },
              avgCurrentValue: { $avg: '$financials.currentValue' },
              avgAfterRepairValue: { $avg: '$financials.afterRepairValue' }
            }
          }
        ]),
        Property.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              avgCompleteness: { $avg: '$dataQuality.completeness' },
              avgAccuracy: { $avg: '$dataQuality.accuracy' }
            }
          }
        ])
      ]);

      const report = {
        reportInfo: {
          generatedAt: new Date().toISOString(),
          generatedBy: req.user._id,
          dateRange: { start, end },
          filters: { county, state, status }
        },
        summary: {
          totalProperties: properties.length,
          averageOpeningBid: averageValues[0]?.avgOpeningBid || 0,
          averageCurrentValue: averageValues[0]?.avgCurrentValue || 0,
          averageAfterRepairValue: averageValues[0]?.avgAfterRepairValue || 0,
          averageDataQuality: dataQualityMetrics[0]?.avgCompleteness || 0
        },
        breakdowns: {
          status: statusBreakdown,
          county: countyBreakdown,
          priority: priorityBreakdown
        },
        properties: properties.map(prop => ({
          id: prop._id,
          address: prop.fullAddress,
          status: prop.leadInfo.status,
          priority: prop.leadInfo.priority,
          openingBid: prop.foreclosureDetails.openingBid,
          currentValue: prop.financials.currentValue,
          assignedTo: prop.leadInfo.assignedTo ? 
            `${prop.leadInfo.assignedTo.firstName} ${prop.leadInfo.assignedTo.lastName}` : 
            'Unassigned',
          dataQuality: prop.dataQuality.completeness
        }))
      };

      if (format === 'csv') {
        const csv = this.convertPropertyReportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=property-report.csv');
        res.send(csv);
      } else {
        res.json({ success: true, data: report });
      }
    } catch (error) {
      logger.error('Error generating property report:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Generate lead performance report
  async generateLeadReport(req, res) {
    try {
      const { 
        startDate, 
        endDate, 
        source,
        status,
        assignedTo,
        format = 'json'
      } = req.query;

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const filter = {
        createdAt: { $gte: start, $lte: end },
        isActive: true
      };

      if (source) filter.source = source;
      if (status) filter.status = status;
      if (assignedTo) filter.assignedTo = assignedTo;

      const [
        leads,
        sourceBreakdown,
        statusBreakdown,
        priorityBreakdown,
        conversionMetrics,
        averageScores
      ] = await Promise.all([
        Lead.find(filter)
          .populate('property', 'address foreclosureDetails')
          .populate('assignedTo', 'firstName lastName'),
        Lead.aggregate([
          { $match: filter },
          { $group: { _id: '$source', count: { $sum: 1 } } }
        ]),
        Lead.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Lead.aggregate([
          { $match: filter },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        Lead.aggregate([
          { $match: { ...filter, isConverted: true } },
          { $count: 'converted' }
        ]),
        Lead.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              avgScore: { $avg: '$score.total' },
              avgMotivation: { $avg: '$score.factors.motivation' },
              avgTimeline: { $avg: '$score.factors.timeline' },
              avgEquity: { $avg: '$score.factors.equity' },
              avgCondition: { $avg: '$score.factors.condition' }
            }
          }
        ])
      ]);

      const totalLeads = leads.length;
      const convertedLeads = conversionMetrics[0]?.converted || 0;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      const report = {
        reportInfo: {
          generatedAt: new Date().toISOString(),
          generatedBy: req.user._id,
          dateRange: { start, end },
          filters: { source, status, assignedTo }
        },
        summary: {
          totalLeads: totalLeads,
          convertedLeads: convertedLeads,
          conversionRate: conversionRate,
          averageScore: averageScores[0]?.avgScore || 0
        },
        breakdowns: {
          source: sourceBreakdown,
          status: statusBreakdown,
          priority: priorityBreakdown
        },
        scoreMetrics: {
          average: averageScores[0]?.avgScore || 0,
          motivation: averageScores[0]?.avgMotivation || 0,
          timeline: averageScores[0]?.avgTimeline || 0,
          equity: averageScores[0]?.avgEquity || 0,
          condition: averageScores[0]?.avgCondition || 0
        },
        leads: leads.map(lead => ({
          id: lead._id,
          leadId: lead.leadId,
          contactName: lead.contact.name,
          propertyAddress: lead.property ? 
            `${lead.property.address.street}, ${lead.property.address.city}` : 
            'N/A',
          source: lead.source,
          status: lead.status,
          priority: lead.priority,
          score: lead.score.total,
          assignedTo: lead.assignedTo ? 
            `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 
            'Unassigned',
          createdAt: lead.createdAt
        }))
      };

      if (format === 'csv') {
        const csv = this.convertLeadReportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=lead-report.csv');
        res.send(csv);
      } else {
        res.json({ success: true, data: report });
      }
    } catch (error) {
      logger.error('Error generating lead report:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get dashboard analytics
  async getDashboardAnalytics(req, res) {
    try {
      const { timeRange = '30d' } = req.query;

      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

      const filter = { createdAt: { $gte: startDate } };

      const [
        propertyMetrics,
        leadMetrics,
        userMetrics,
        analysisMetrics,
        recentActivity,
        topPerformers
      ] = await Promise.all([
        this.getPropertyStats(filter),
        this.getLeadStats(filter),
        this.getUserStats(filter),
        this.getAnalysisStats(filter),
        this.getRecentActivity(filter),
        this.getTopPerformers(filter)
      ]);

      res.json({
        success: true,
        data: {
          timeRange,
          propertyMetrics,
          leadMetrics,
          userMetrics,
          analysisMetrics,
          recentActivity,
          topPerformers
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard analytics:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Helper methods
  async getPropertyStats(filter) {
    const [
      total,
      statusBreakdown,
      priorityBreakdown,
      averageValue
    ] = await Promise.all([
      Property.countDocuments({ ...filter, isActive: true }),
      Property.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: '$leadInfo.status', count: { $sum: 1 } } }
      ]),
      Property.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: '$leadInfo.priority', count: { $sum: 1 } } }
      ]),
      Property.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: null, avgValue: { $avg: '$foreclosureDetails.openingBid' } } }
      ])
    ]);

    return {
      total,
      statusBreakdown,
      priorityBreakdown,
      averageValue: averageValue[0]?.avgValue || 0
    };
  }

  async getLeadStats(filter) {
    const [
      total,
      sourceBreakdown,
      statusBreakdown,
      averageScore
    ] = await Promise.all([
      Lead.countDocuments({ ...filter, isActive: true }),
      Lead.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
      Lead.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Lead.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: null, avgScore: { $avg: '$score.total' } } }
      ])
    ]);

    return {
      total,
      sourceBreakdown,
      statusBreakdown,
      averageScore: averageScore[0]?.avgScore || 0
    };
  }

  async getUserStats(filter) {
    const [
      total,
      roleBreakdown,
      subscriptionBreakdown
    ] = await Promise.all([
      User.countDocuments({ ...filter, isActive: true }),
      User.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
      ])
    ]);

    return {
      total,
      roleBreakdown,
      subscriptionBreakdown
    };
  }

  async getAnalysisStats(filter) {
    const [
      total,
      typeBreakdown,
      averageROI
    ] = await Promise.all([
      Analysis.countDocuments({ ...filter, isActive: true }),
      Analysis.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      Analysis.aggregate([
        { $match: { ...filter, isActive: true } },
        { $group: { _id: null, avgROI: { $avg: '$financials.roi' } } }
      ])
    ]);

    return {
      total,
      typeBreakdown,
      averageROI: averageROI[0]?.avgROI || 0
    };
  }

  async getTopProperties(filter) {
    return Property.find({ ...filter, isActive: true })
      .sort({ 'dataQuality.completeness': -1 })
      .limit(5)
      .select('address foreclosureDetails dataQuality leadInfo')
      .populate('leadInfo.assignedTo', 'firstName lastName');
  }

  async getTopLeads(filter) {
    return Lead.find({ ...filter, isActive: true })
      .sort({ 'score.total': -1 })
      .limit(5)
      .populate('property', 'address')
      .populate('assignedTo', 'firstName lastName');
  }

  async getConversionMetrics(filter) {
    const [
      totalLeads,
      convertedLeads,
      averageDealSize
    ] = await Promise.all([
      Lead.countDocuments({ ...filter, isActive: true }),
      Lead.countDocuments({ ...filter, isActive: true, isConverted: true }),
      Lead.aggregate([
        { $match: { ...filter, isActive: true, isConverted: true } },
        { $group: { _id: null, avgDealSize: { $avg: '$conversion.dealValue' } } }
      ])
    ]);

    return {
      totalLeads,
      convertedLeads,
      overallConversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
      averageDealSize: averageDealSize[0]?.avgDealSize || 0
    };
  }

  async getMarketTrends(filter) {
    // This would typically integrate with external market data APIs
    return {
      averageDaysOnMarket: 45,
      priceAppreciation: 3.2,
      inventoryLevel: 12,
      marketActivity: 'Moderate'
    };
  }

  async getRecentActivity(filter) {
    const [
      recentProperties,
      recentLeads,
      recentAnalyses
    ] = await Promise.all([
      Property.find({ ...filter, isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('address foreclosureDetails leadInfo createdAt'),
      Lead.find({ ...filter, isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('contact source status score createdAt'),
      Analysis.find({ ...filter, isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type status financials createdAt')
    ]);

    return {
      properties: recentProperties,
      leads: recentLeads,
      analyses: recentAnalyses
    };
  }

  async getTopPerformers(filter) {
    const [
      topProperties,
      topLeads,
      topAnalyses
    ] = await Promise.all([
      Property.find({ ...filter, isActive: true })
        .sort({ 'dataQuality.completeness': -1 })
        .limit(3)
        .select('address foreclosureDetails dataQuality'),
      Lead.find({ ...filter, isActive: true })
        .sort({ 'score.total': -1 })
        .limit(3)
        .select('contact source score'),
      Analysis.find({ ...filter, isActive: true })
        .sort({ 'financials.roi': -1 })
        .limit(3)
        .select('type financials')
    ]);

    return {
      properties: topProperties,
      leads: topLeads,
      analyses: topAnalyses
    };
  }

  async generateChartData(filter) {
    // Generate data for charts
    const monthlyData = await Property.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    return {
      monthlyTrends: monthlyData,
      // Add more chart data as needed
    };
  }

  convertReportToCSV(report) {
    // Convert report to CSV format
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Properties', report.summary.totalProperties],
      ['Total Leads', report.summary.totalLeads],
      ['Total Users', report.summary.totalUsers],
      ['Conversion Rate', report.summary.conversionRate],
      ['Average Deal Size', report.summary.averageDealSize]
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  convertPropertyReportToCSV(report) {
    const headers = ['Address', 'Status', 'Priority', 'Opening Bid', 'Current Value', 'Assigned To', 'Data Quality'];
    const rows = report.properties.map(prop => [
      prop.address,
      prop.status,
      prop.priority,
      prop.openingBid,
      prop.currentValue,
      prop.assignedTo,
      prop.dataQuality
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  convertLeadReportToCSV(report) {
    const headers = ['Lead ID', 'Contact Name', 'Property Address', 'Source', 'Status', 'Priority', 'Score', 'Assigned To'];
    const rows = report.leads.map(lead => [
      lead.leadId,
      lead.contactName,
      lead.propertyAddress,
      lead.source,
      lead.status,
      lead.priority,
      lead.score,
      lead.assignedTo
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = new ReportController();
