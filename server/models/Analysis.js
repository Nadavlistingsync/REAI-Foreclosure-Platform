const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  // Analysis Identification
  analysisId: { type: String, unique: true, required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Analysis Type
  type: {
    type: String,
    enum: ['Flip Analysis', 'Rental Analysis', 'Wholesale Analysis', 'Commercial Analysis', 'Land Analysis'],
    required: true
  },
  
  // Property Valuation
  valuation: {
    currentValue: { type: Number, required: true },
    afterRepairValue: { type: Number, required: true },
    repairCosts: { type: Number, required: true },
    maximumAllowableOffer: { type: Number, required: true },
    confidence: { type: Number, min: 0, max: 100, default: 75 }
  },

  // Financial Analysis
  financials: {
    // Purchase Costs
    purchasePrice: { type: Number },
    closingCosts: { type: Number, default: 0 },
    inspectionCosts: { type: Number, default: 0 },
    legalCosts: { type: Number, default: 0 },
    
    // Holding Costs
    holdingPeriod: { type: Number, default: 6 }, // months
    monthlyHoldingCosts: { type: Number, default: 0 },
    totalHoldingCosts: { type: Number, default: 0 },
    
    // Selling Costs
    realtorCommission: { type: Number, default: 0 },
    stagingCosts: { type: Number, default: 0 },
    marketingCosts: { type: Number, default: 0 },
    otherSellingCosts: { type: Number, default: 0 },
    
    // Financing
    financingType: {
      type: String,
      enum: ['Cash', 'Hard Money', 'Private Money', 'Traditional', 'Owner Financing'],
      default: 'Cash'
    },
    downPayment: { type: Number, default: 0 },
    loanAmount: { type: Number, default: 0 },
    interestRate: { type: Number, default: 0 },
    loanTerm: { type: Number, default: 0 },
    monthlyPayment: { type: Number, default: 0 },
    
    // Returns
    totalInvestment: { type: Number },
    netProfit: { type: Number },
    roi: { type: Number },
    cashOnCashReturn: { type: Number },
    irr: { type: Number }
  },

  // Rental Analysis (if applicable)
  rental: {
    monthlyRent: { type: Number },
    annualRent: { type: Number },
    vacancyRate: { type: Number, default: 5 }, // percentage
    managementFee: { type: Number, default: 10 }, // percentage
    maintenanceReserve: { type: Number, default: 5 }, // percentage
    insurance: { type: Number, default: 0 },
    propertyTaxes: { type: Number, default: 0 },
    hoa: { type: Number, default: 0 },
    utilities: { type: Number, default: 0 },
    netOperatingIncome: { type: Number },
    capRate: { type: Number },
    cashFlow: { type: Number },
    grossRentMultiplier: { type: Number }
  },

  // Market Analysis
  market: {
    neighborhoodRating: { type: Number, min: 1, max: 10 },
    schoolRating: { type: Number, min: 1, max: 10 },
    crimeRating: { type: Number, min: 1, max: 10 },
    appreciation: { type: Number, default: 3 }, // annual percentage
    daysOnMarket: { type: Number },
    pricePerSqFt: { type: Number },
    comparableSales: [{
      address: { type: String },
      salePrice: { type: Number },
      saleDate: { type: Date },
      squareFeet: { type: Number },
      pricePerSqFt: { type: Number },
      distance: { type: Number }
    }]
  },

  // Risk Assessment
  risk: {
    overall: { type: Number, min: 1, max: 10 },
    factors: {
      market: { type: Number, min: 1, max: 10 },
      property: { type: Number, min: 1, max: 10 },
      financing: { type: Number, min: 1, max: 10 },
      timeline: { type: Number, min: 1, max: 10 }
    },
    mitigation: [String]
  },

  // Repair Analysis
  repairs: [{
    category: { type: String, required: true },
    description: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    actualCost: { type: Number },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    timeline: { type: Number, default: 1 }, // weeks
    contractor: { type: String },
    status: { type: String, enum: ['Planned', 'In Progress', 'Completed', 'Cancelled'], default: 'Planned' }
  }],

  // Timeline
  timeline: {
    purchaseDate: { type: Date },
    renovationStart: { type: Date },
    renovationEnd: { type: Date },
    listingDate: { type: Date },
    expectedSaleDate: { type: Date },
    actualSaleDate: { type: Date }
  },

  // Assumptions and Notes
  assumptions: [String],
  notes: { type: String },
  recommendations: [String],

  // Analysis Status
  status: {
    type: String,
    enum: ['Draft', 'In Review', 'Approved', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Draft'
  },
  
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
analysisSchema.index({ analysisId: 1 });
analysisSchema.index({ property: 1 });
analysisSchema.index({ user: 1 });
analysisSchema.index({ type: 1 });
analysisSchema.index({ status: 1 });
analysisSchema.index({ 'financials.roi': -1 });
analysisSchema.index({ createdAt: -1 });

// Virtual for total repair costs
analysisSchema.virtual('totalRepairCosts').get(function() {
  return this.repairs.reduce((total, repair) => total + (repair.actualCost || repair.estimatedCost), 0);
});

// Virtual for analysis age
analysisSchema.virtual('analysisAge').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
analysisSchema.pre('save', function(next) {
  // Generate analysis ID if not present
  if (!this.analysisId) {
    const crypto = require('crypto');
    this.analysisId = 'ANALYSIS-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  
  // Calculate financial metrics
  if (this.financials.purchasePrice && this.financials.repairCosts) {
    this.financials.totalInvestment = this.financials.purchasePrice + this.financials.repairCosts + this.financials.closingCosts;
  }
  
  if (this.valuation.afterRepairValue && this.financials.totalInvestment) {
    this.financials.netProfit = this.valuation.afterRepairValue - this.financials.totalInvestment;
    this.financials.roi = (this.financials.netProfit / this.financials.totalInvestment) * 100;
  }
  
  // Calculate rental metrics
  if (this.rental.monthlyRent) {
    this.rental.annualRent = this.rental.monthlyRent * 12;
    
    const vacancyLoss = this.rental.annualRent * (this.rental.vacancyRate / 100);
    const managementFee = this.rental.annualRent * (this.rental.managementFee / 100);
    const maintenanceReserve = this.rental.annualRent * (this.rental.maintenanceReserve / 100);
    
    this.rental.netOperatingIncome = this.rental.annualRent - vacancyLoss - managementFee - maintenanceReserve - 
                                   this.rental.insurance - this.rental.propertyTaxes - this.rental.hoa - this.rental.utilities;
    
    if (this.financials.purchasePrice) {
      this.rental.capRate = (this.rental.netOperatingIncome / this.financials.purchasePrice) * 100;
    }
    
    if (this.financials.monthlyPayment) {
      this.rental.cashFlow = this.rental.monthlyRent - this.financials.monthlyPayment;
    }
  }
  
  next();
});

// Method to update repair status
analysisSchema.methods.updateRepairStatus = function(repairId, status, actualCost) {
  const repair = this.repairs.id(repairId);
  if (repair) {
    repair.status = status;
    if (actualCost) repair.actualCost = actualCost;
    return this.save();
  }
  throw new Error('Repair not found');
};

// Method to add repair
analysisSchema.methods.addRepair = function(repairData) {
  this.repairs.push(repairData);
  return this.save();
};

// Method to calculate updated ROI
analysisSchema.methods.calculateUpdatedROI = function() {
  const totalRepairCosts = this.repairs.reduce((total, repair) => total + (repair.actualCost || repair.estimatedCost), 0);
  const totalInvestment = this.financials.purchasePrice + totalRepairCosts + this.financials.closingCosts;
  const netProfit = this.valuation.afterRepairValue - totalInvestment;
  const roi = (netProfit / totalInvestment) * 100;
  
  this.financials.totalInvestment = totalInvestment;
  this.financials.netProfit = netProfit;
  this.financials.roi = roi;
  
  return this.save();
};

module.exports = mongoose.model('Analysis', analysisSchema);
