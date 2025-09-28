const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Lead Identification
  leadId: { type: String, unique: true, required: true },
  source: {
    type: String,
    enum: ['Pre-Foreclosure', 'Auction', 'REO', 'Wholesale', 'Direct Mail', 'Referral', 'Website', 'Other'],
    required: true
  },
  
  // Property Reference
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  
  // Contact Information
  contact: {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    preferredContact: { type: String, enum: ['Phone', 'Email', 'Text', 'Mail'], default: 'Phone' },
    bestTimeToCall: { type: String },
    timeZone: { type: String, default: 'America/New_York' }
  },

  // Lead Status and Priority
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Interested', 'Not Interested', 'Under Contract', 'Closed', 'Lost'],
    default: 'New'
  },
  
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  
  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedDate: { type: Date },
  
  // Lead Scoring
  score: {
    total: { type: Number, min: 0, max: 100, default: 0 },
    factors: {
      motivation: { type: Number, min: 0, max: 25, default: 0 },
      timeline: { type: Number, min: 0, max: 25, default: 0 },
      equity: { type: Number, min: 0, max: 25, default: 0 },
      condition: { type: Number, min: 0, max: 25, default: 0 }
    }
  },

  // Communication History
  communications: [{
    type: {
      type: String,
      enum: ['Call', 'Email', 'Text', 'Mail', 'Meeting', 'Note'],
      required: true
    },
    direction: {
      type: String,
      enum: ['Inbound', 'Outbound'],
      required: true
    },
    date: { type: Date, default: Date.now },
    duration: { type: Number }, // in minutes for calls
    subject: { type: String },
    content: { type: String, required: true },
    outcome: { type: String },
    nextAction: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  }],

  // Lead Details
  details: {
    motivation: {
      type: String,
      enum: ['Financial Distress', 'Relocation', 'Divorce', 'Inheritance', 'Investment', 'Other'],
      default: 'Other'
    },
    timeline: {
      type: String,
      enum: ['Immediate', '1-3 Months', '3-6 Months', '6+ Months', 'Flexible'],
      default: 'Flexible'
    },
    askingPrice: { type: Number },
    minimumPrice: { type: Number },
    financing: {
      type: String,
      enum: ['Cash', 'Financing Needed', 'Owner Financing', 'Unknown'],
      default: 'Unknown'
    },
    condition: {
      type: String,
      enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown'],
      default: 'Unknown'
    },
    repairs: { type: String },
    occupancy: {
      type: String,
      enum: ['Owner Occupied', 'Tenant Occupied', 'Vacant', 'Unknown'],
      default: 'Unknown'
    }
  },

  // Marketing Campaign
  campaign: {
    campaignId: { type: String },
    campaignName: { type: String },
    touchpoints: [{
      date: { type: Date },
      method: { type: String },
      response: { type: String },
      cost: { type: Number }
    }],
    totalCost: { type: Number, default: 0 },
    roi: { type: Number }
  },

  // Follow-up Schedule
  followUp: {
    nextAction: { type: String },
    nextActionDate: { type: Date },
    reminderSet: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'As Needed'],
      default: 'Weekly'
    }
  },

  // Conversion Tracking
  conversion: {
    isConverted: { type: Boolean, default: false },
    convertedDate: { type: Date },
    convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dealValue: { type: Number },
    commission: { type: Number },
    notes: { type: String }
  },

  // Tags and Categories
  tags: [String],
  categories: [String],

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

// Indexes
leadSchema.index({ leadId: 1 });
leadSchema.index({ property: 1 });
leadSchema.index({ 'contact.phone': 1 });
leadSchema.index({ 'contact.email': 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ 'score.total': -1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ 'followUp.nextActionDate': 1 });

// Virtual for days since last contact
leadSchema.virtual('daysSinceLastContact').get(function() {
  if (this.communications.length === 0) return null;
  const lastComm = this.communications[this.communications.length - 1];
  return Math.floor((new Date() - lastComm.date) / (1000 * 60 * 60 * 24));
});

// Virtual for lead age
leadSchema.virtual('leadAge').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for communication count
leadSchema.virtual('communicationCount').get(function() {
  return this.communications.length;
});

// Pre-save middleware
leadSchema.pre('save', function(next) {
  // Generate lead ID if not present
  if (!this.leadId) {
    const crypto = require('crypto');
    this.leadId = 'LEAD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  
  // Calculate lead score
  this.score.total = 
    this.score.factors.motivation +
    this.score.factors.timeline +
    this.score.factors.equity +
    this.score.factors.condition;
  
  // Calculate data quality
  let completeness = 0;
  if (this.contact.name) completeness += 20;
  if (this.contact.phone) completeness += 20;
  if (this.contact.email) completeness += 20;
  if (this.details.motivation) completeness += 20;
  if (this.details.timeline) completeness += 20;
  
  this.dataQuality.completeness = completeness;
  
  next();
});

// Method to add communication
leadSchema.methods.addCommunication = function(commData) {
  this.communications.push(commData);
  return this.save();
};

// Method to update status
leadSchema.methods.updateStatus = function(newStatus, userId) {
  this.status = newStatus;
  this.updatedBy = userId;
  return this.save();
};

// Method to assign lead
leadSchema.methods.assignTo = function(userId) {
  this.assignedTo = userId;
  this.assignedDate = new Date();
  return this.save();
};

// Method to calculate ROI
leadSchema.methods.calculateROI = function() {
  if (this.campaign.totalCost > 0 && this.conversion.dealValue) {
    this.campaign.roi = ((this.conversion.dealValue - this.campaign.totalCost) / this.campaign.totalCost) * 100;
  }
  return this.campaign.roi;
};

module.exports = mongoose.model('Lead', leadSchema);
