const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, trim: true },
  
  // Profile Information
  profile: {
    avatar: { type: String },
    bio: { type: String, maxlength: 500 },
    company: { type: String },
    title: { type: String },
    website: { type: String },
    linkedin: { type: String },
    experience: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
    investmentFocus: [{
      type: String,
      enum: ['Fix and Flip', 'Buy and Hold', 'Wholesaling', 'Commercial', 'Land Development']
    }],
    targetMarkets: [String],
    investmentBudget: {
      min: { type: Number },
      max: { type: Number }
    }
  },

  // Account Settings
  role: {
    type: String,
    enum: ['Admin', 'Manager', 'Agent', 'Investor', 'Viewer'],
    default: 'Investor'
  },
  
  subscription: {
    plan: {
      type: String,
      enum: ['Free', 'Basic', 'Professional', 'Enterprise'],
      default: 'Free'
    },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    features: [String]
  },

  // Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      newLeads: { type: Boolean, default: true },
      priceDrops: { type: Boolean, default: true },
      auctionReminders: { type: Boolean, default: true }
    },
    searchFilters: {
      minPrice: { type: Number },
      maxPrice: { type: Number },
      propertyTypes: [String],
      foreclosureStatus: [String],
      counties: [String],
      maxDistance: { type: Number }
    },
    dashboard: {
      defaultView: { type: String, enum: ['List', 'Map', 'Analytics'], default: 'List' },
      itemsPerPage: { type: Number, default: 20 },
      sortBy: { type: String, default: 'createdAt' },
      sortOrder: { type: String, enum: ['asc', 'desc'], default: 'desc' }
    }
  },

  // Activity Tracking
  activity: {
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 },
    propertiesViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    searchesPerformed: { type: Number, default: 0 },
    leadsGenerated: { type: Number, default: 0 },
    dealsClosed: { type: Number, default: 0 }
  },

  // Team Information
  team: {
    isTeamMember: { type: Boolean, default: false },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    permissions: [String]
  },

  // API Access
  apiAccess: {
    isEnabled: { type: Boolean, default: false },
    apiKey: { type: String },
    rateLimit: { type: Number, default: 1000 },
    lastUsed: { type: Date }
  },

  // Account Status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  
  // Billing Information
  billing: {
    customerId: { type: String }, // Stripe customer ID
    paymentMethod: { type: String },
    billingAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ 'subscription.isActive': 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for subscription status
userSchema.virtual('subscriptionStatus').get(function() {
  if (!this.subscription.isActive) return 'Inactive';
  if (this.subscription.endDate && this.subscription.endDate < new Date()) return 'Expired';
  return 'Active';
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate API key
userSchema.methods.generateApiKey = function() {
  const crypto = require('crypto');
  this.apiAccess.apiKey = crypto.randomBytes(32).toString('hex');
  this.apiAccess.lastUsed = new Date();
  return this.apiAccess.apiKey;
};

// Method to check if user has permission
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'Admin') return true;
  if (this.team && this.team.permissions) {
    return this.team.permissions.includes(permission);
  }
  return false;
};

// Method to update activity
userSchema.methods.updateActivity = function() {
  this.activity.lastLogin = new Date();
  this.activity.loginCount += 1;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
