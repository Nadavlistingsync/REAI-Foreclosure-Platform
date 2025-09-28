const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  // Basic Property Information
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    county: { type: String, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },

  // Property Details
  propertyType: {
    type: String,
    enum: ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Commercial', 'Land'],
    required: true
  },
  
  bedrooms: { type: Number, min: 0 },
  bathrooms: { type: Number, min: 0 },
  squareFeet: { type: Number, min: 0 },
  lotSize: { type: Number, min: 0 },
  yearBuilt: { type: Number },
  
  // Foreclosure Information
  foreclosureStatus: {
    type: String,
    enum: ['Pre-Foreclosure', 'Auction', 'REO', 'Sold', 'Cancelled'],
    required: true
  },
  
  foreclosureDetails: {
    noticeOfDefaultDate: { type: Date },
    auctionDate: { type: Date },
    auctionLocation: { type: String },
    openingBid: { type: Number },
    trusteeSaleNumber: { type: String },
    caseNumber: { type: String },
    lender: { type: String },
    loanAmount: { type: Number },
    estimatedValue: { type: Number },
    estimatedEquity: { type: Number }
  },

  // Financial Information
  financials: {
    currentValue: { type: Number },
    afterRepairValue: { type: Number },
    repairCosts: { type: Number },
    maximumAllowableOffer: { type: Number },
    rentalIncome: { type: Number },
    capRate: { type: Number },
    cashFlow: { type: Number },
    roi: { type: Number }
  },

  // Property Condition
  condition: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown'],
    default: 'Unknown'
  },
  
  repairs: [{
    category: { type: String, required: true },
    description: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' }
  }],

  // Ownership Information
  owner: {
    name: { type: String },
    contactInfo: {
      phone: { type: String },
      email: { type: String },
      address: { type: String }
    },
    mailingAddress: { type: String },
    isAbsenteeOwner: { type: Boolean, default: false }
  },

  // Tax Information
  taxInfo: {
    assessedValue: { type: Number },
    annualTaxes: { type: Number },
    taxDelinquent: { type: Boolean, default: false },
    taxDelinquentAmount: { type: Number },
    lastTaxPayment: { type: Date }
  },

  // Liens and Encumbrances
  liens: [{
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    lienholder: { type: String, required: true },
    dateRecorded: { type: Date },
    priority: { type: Number }
  }],

  // Market Data
  marketData: {
    daysOnMarket: { type: Number },
    priceHistory: [{
      date: { type: Date },
      price: { type: Number },
      event: { type: String }
    }],
    comparableSales: [{
      address: { type: String },
      salePrice: { type: Number },
      saleDate: { type: Date },
      squareFeet: { type: Number },
      distance: { type: Number }
    }],
    neighborhoodStats: {
      medianPrice: { type: Number },
      averageDaysOnMarket: { type: Number },
      pricePerSqFt: { type: Number },
      inventory: { type: Number }
    }
  },

  // Lead Information
  leadInfo: {
    source: { type: String, required: true },
    dateFound: { type: Date, default: Date.now },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Negotiating', 'Under Contract', 'Closed', 'Lost'],
      default: 'New'
    },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium'
    },
    notes: [{
      date: { type: Date, default: Date.now },
      note: { type: String, required: true },
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  },

  // Data Quality
  dataQuality: {
    completeness: { type: Number, min: 0, max: 100 },
    accuracy: { type: Number, min: 0, max: 100 },
    lastVerified: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // System Fields
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
propertySchema.index({ 'address.street': 1, 'address.city': 1, 'address.state': 1 });
propertySchema.index({ foreclosureStatus: 1 });
propertySchema.index({ 'foreclosureDetails.auctionDate': 1 });
propertySchema.index({ 'leadInfo.assignedTo': 1 });
propertySchema.index({ 'leadInfo.status': 1 });
propertySchema.index({ 'leadInfo.priority': 1 });
propertySchema.index({ createdAt: -1 });

// Virtual for full address
propertySchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Virtual for estimated profit
propertySchema.virtual('estimatedProfit').get(function() {
  if (this.financials.afterRepairValue && this.financials.repairCosts && this.foreclosureDetails.openingBid) {
    return this.financials.afterRepairValue - this.financials.repairCosts - this.foreclosureDetails.openingBid;
  }
  return null;
});

// Pre-save middleware
propertySchema.pre('save', function(next) {
  // Calculate data quality score
  let completeness = 0;
  let totalFields = 0;
  
  // Check required fields
  if (this.address.street) completeness += 10;
  if (this.address.city) completeness += 10;
  if (this.address.state) completeness += 10;
  if (this.address.zipCode) completeness += 10;
  if (this.propertyType) completeness += 10;
  if (this.foreclosureStatus) completeness += 10;
  if (this.foreclosureDetails.lender) completeness += 10;
  if (this.owner.name) completeness += 10;
  if (this.financials.currentValue) completeness += 10;
  if (this.condition) completeness += 10;
  
  this.dataQuality.completeness = completeness;
  next();
});

module.exports = mongoose.model('Property', propertySchema);
