const Analysis = require('../models/Analysis');
const Property = require('../models/Property');
const logger = require('../utils/logger');

class AnalysisController {
  // Get all analyses
  async getAnalyses(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        status,
        propertyId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = { isActive: true };
      
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (propertyId) filter.property = propertyId;
      if (req.user.role !== 'Admin') {
        filter.user = req.user._id; // Users can only see their own analyses
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const analyses = await Analysis.find(filter)
        .populate('property', 'address foreclosureDetails financials')
        .populate('user', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Analysis.countDocuments(filter);

      res.json({
        success: true,
        data: analyses,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } catch (error) {
      logger.error('Error getting analyses:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get single analysis by ID
  async getAnalysis(req, res) {
    try {
      const analysis = await Analysis.findById(req.params.id)
        .populate('property')
        .populate('user', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName');

      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found' });
      }

      // Check if user has access to this analysis
      if (req.user.role !== 'Admin' && analysis.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      res.json({ success: true, data: analysis });
    } catch (error) {
      logger.error('Error getting analysis:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Create new analysis
  async createAnalysis(req, res) {
    try {
      const analysisData = {
        ...req.body,
        user: req.user._id,
        createdBy: req.user._id,
        updatedBy: req.user._id
      };

      // Validate property exists
      const property = await Property.findById(analysisData.property);
      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      const analysis = await Analysis.create(analysisData);

      // Populate the analysis for response
      await analysis.populate('property user createdBy');

      res.status(201).json({ success: true, data: analysis });
    } catch (error) {
      logger.error('Error creating analysis:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update analysis
  async updateAnalysis(req, res) {
    try {
      const analysis = await Analysis.findById(req.params.id);

      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found' });
      }

      // Check if user has access to this analysis
      if (req.user.role !== 'Admin' && analysis.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const updatedAnalysis = await Analysis.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
      ).populate('property user createdBy');

      res.json({ success: true, data: updatedAnalysis });
    } catch (error) {
      logger.error('Error updating analysis:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Delete analysis (soft delete)
  async deleteAnalysis(req, res) {
    try {
      const analysis = await Analysis.findById(req.params.id);

      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found' });
      }

      // Check if user has access to this analysis
      if (req.user.role !== 'Admin' && analysis.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      await Analysis.findByIdAndUpdate(
        req.params.id,
        { isActive: false, updatedBy: req.user._id },
        { new: true }
      );

      res.json({ success: true, message: 'Analysis deleted successfully' });
    } catch (error) {
      logger.error('Error deleting analysis:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Calculate flip analysis
  async calculateFlipAnalysis(req, res) {
    try {
      const {
        propertyId,
        purchasePrice,
        repairCosts,
        holdingPeriod = 6,
        sellingCosts = 0,
        financingType = 'Cash',
        downPayment = 0,
        interestRate = 0,
        loanTerm = 0
      } = req.body;

      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      // Get current market data
      const afterRepairValue = property.financials.afterRepairValue || property.financials.currentValue;
      
      if (!afterRepairValue) {
        return res.status(400).json({ success: false, message: 'Property value not available' });
      }

      // Calculate financial metrics
      const totalInvestment = purchasePrice + repairCosts + sellingCosts;
      const netProfit = afterRepairValue - totalInvestment;
      const roi = (netProfit / totalInvestment) * 100;

      // Calculate holding costs
      const monthlyHoldingCosts = (purchasePrice * 0.01) / 12; // 1% annually
      const totalHoldingCosts = monthlyHoldingCosts * holdingPeriod;

      // Calculate financing costs
      let financingCosts = 0;
      if (financingType !== 'Cash') {
        const loanAmount = purchasePrice - downPayment;
        const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, loanTerm);
        financingCosts = monthlyPayment * holdingPeriod;
      }

      const finalNetProfit = netProfit - totalHoldingCosts - financingCosts;
      const finalROI = (finalNetProfit / totalInvestment) * 100;

      const analysis = {
        type: 'Flip Analysis',
        property: propertyId,
        user: req.user._id,
        valuation: {
          currentValue: property.financials.currentValue,
          afterRepairValue: afterRepairValue,
          repairCosts: repairCosts,
          maximumAllowableOffer: afterRepairValue - repairCosts - 20000 // 20k profit buffer
        },
        financials: {
          purchasePrice: purchasePrice,
          repairCosts: repairCosts,
          holdingPeriod: holdingPeriod,
          monthlyHoldingCosts: monthlyHoldingCosts,
          totalHoldingCosts: totalHoldingCosts,
          sellingCosts: sellingCosts,
          financingType: financingType,
          downPayment: downPayment,
          loanAmount: purchasePrice - downPayment,
          interestRate: interestRate,
          loanTerm: loanTerm,
          monthlyPayment: financingType !== 'Cash' ? this.calculateMonthlyPayment(purchasePrice - downPayment, interestRate, loanTerm) : 0,
          totalInvestment: totalInvestment,
          netProfit: finalNetProfit,
          roi: finalROI
        },
        status: 'Draft'
      };

      res.json({ success: true, data: analysis });
    } catch (error) {
      logger.error('Error calculating flip analysis:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Calculate rental analysis
  async calculateRentalAnalysis(req, res) {
    try {
      const {
        propertyId,
        monthlyRent,
        vacancyRate = 5,
        managementFee = 10,
        maintenanceReserve = 5,
        insurance = 0,
        propertyTaxes = 0,
        hoa = 0,
        utilities = 0,
        purchasePrice,
        downPayment = 0,
        interestRate = 0,
        loanTerm = 0
      } = req.body;

      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      // Calculate rental metrics
      const annualRent = monthlyRent * 12;
      const vacancyLoss = annualRent * (vacancyRate / 100);
      const managementCost = annualRent * (managementFee / 100);
      const maintenanceCost = annualRent * (maintenanceReserve / 100);
      
      const totalOperatingExpenses = vacancyLoss + managementCost + maintenanceCost + 
                                   insurance + propertyTaxes + hoa + utilities;
      
      const netOperatingIncome = annualRent - totalOperatingExpenses;

      // Calculate financing
      const loanAmount = purchasePrice - downPayment;
      const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, loanTerm);
      const annualDebtService = monthlyPayment * 12;

      // Calculate returns
      const cashFlow = monthlyRent - monthlyPayment;
      const annualCashFlow = cashFlow * 12;
      const capRate = (netOperatingIncome / purchasePrice) * 100;
      const cashOnCashReturn = (annualCashFlow / downPayment) * 100;
      const grossRentMultiplier = purchasePrice / annualRent;

      const analysis = {
        type: 'Rental Analysis',
        property: propertyId,
        user: req.user._id,
        valuation: {
          currentValue: property.financials.currentValue,
          afterRepairValue: property.financials.afterRepairValue || property.financials.currentValue,
          repairCosts: property.financials.repairCosts || 0,
          maximumAllowableOffer: purchasePrice
        },
        financials: {
          purchasePrice: purchasePrice,
          downPayment: downPayment,
          loanAmount: loanAmount,
          interestRate: interestRate,
          loanTerm: loanTerm,
          monthlyPayment: monthlyPayment
        },
        rental: {
          monthlyRent: monthlyRent,
          annualRent: annualRent,
          vacancyRate: vacancyRate,
          managementFee: managementFee,
          maintenanceReserve: maintenanceReserve,
          insurance: insurance,
          propertyTaxes: propertyTaxes,
          hoa: hoa,
          utilities: utilities,
          netOperatingIncome: netOperatingIncome,
          capRate: capRate,
          cashFlow: cashFlow,
          grossRentMultiplier: grossRentMultiplier
        },
        status: 'Draft'
      };

      res.json({ success: true, data: analysis });
    } catch (error) {
      logger.error('Error calculating rental analysis:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Calculate wholesale analysis
  async calculateWholesaleAnalysis(req, res) {
    try {
      const {
        propertyId,
        assignmentFee = 10000,
        estimatedRepairCosts = 0,
        estimatedAfterRepairValue = 0
      } = req.body;

      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      const currentValue = property.financials.currentValue;
      const afterRepairValue = estimatedAfterRepairValue || property.financials.afterRepairValue || currentValue;
      const repairCosts = estimatedRepairCosts || property.financials.repairCosts || 0;

      // Calculate maximum allowable offer for end buyer
      const endBuyerMaxOffer = afterRepairValue - repairCosts - 20000; // 20k profit buffer
      
      // Calculate wholesale metrics
      const maximumAllowableOffer = endBuyerMaxOffer - assignmentFee;
      const potentialProfit = assignmentFee;
      const roi = (potentialProfit / maximumAllowableOffer) * 100;

      const analysis = {
        type: 'Wholesale Analysis',
        property: propertyId,
        user: req.user._id,
        valuation: {
          currentValue: currentValue,
          afterRepairValue: afterRepairValue,
          repairCosts: repairCosts,
          maximumAllowableOffer: maximumAllowableOffer
        },
        financials: {
          assignmentFee: assignmentFee,
          maximumAllowableOffer: maximumAllowableOffer,
          endBuyerMaxOffer: endBuyerMaxOffer,
          potentialProfit: potentialProfit,
          roi: roi
        },
        status: 'Draft'
      };

      res.json({ success: true, data: analysis });
    } catch (error) {
      logger.error('Error calculating wholesale analysis:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update repair status
  async updateRepairStatus(req, res) {
    try {
      const { repairId, status, actualCost } = req.body;

      const analysis = await Analysis.findById(req.params.id);
      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found' });
      }

      // Check if user has access to this analysis
      if (req.user.role !== 'Admin' && analysis.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      await analysis.updateRepairStatus(repairId, status, actualCost);

      res.json({ success: true, data: analysis });
    } catch (error) {
      logger.error('Error updating repair status:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get analysis analytics
  async getAnalysisAnalytics(req, res) {
    try {
      const { timeRange = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

      // Build filter
      const filter = {
        isActive: true,
        createdAt: { $gte: startDate }
      };

      if (req.user.role !== 'Admin') {
        filter.user = req.user._id;
      }

      // Get analytics data
      const [
        totalAnalyses,
        typeBreakdown,
        statusBreakdown,
        averageROI,
        topAnalyses
      ] = await Promise.all([
        Analysis.countDocuments(filter),
        Analysis.aggregate([
          { $match: filter },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        Analysis.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Analysis.aggregate([
          { $match: filter },
          { $group: { _id: null, avgROI: { $avg: '$financials.roi' } } }
        ]),
        Analysis.find(filter)
          .sort({ 'financials.roi': -1 })
          .limit(5)
          .populate('property', 'address')
          .populate('user', 'firstName lastName')
      ]);

      res.json({
        success: true,
        data: {
          totalAnalyses,
          typeBreakdown,
          statusBreakdown,
          averageROI: averageROI[0]?.avgROI || 0,
          topAnalyses
        }
      });
    } catch (error) {
      logger.error('Error getting analysis analytics:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Helper method to calculate monthly payment
  calculateMonthlyPayment(principal, annualRate, years) {
    if (annualRate === 0) return principal / (years * 12);
    
    const monthlyRate = annualRate / 100 / 12;
    const numberOfPayments = years * 12;
    
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
           (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  }
}

module.exports = new AnalysisController();
