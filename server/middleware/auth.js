const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ message: 'Not authorized, account deactivated' });
      }

      next();
    } catch (error) {
      logger.error('Auth middleware error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }

    next();
  };
};

// Check subscription
const checkSubscription = (requiredPlan) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const planHierarchy = ['Free', 'Basic', 'Professional', 'Enterprise'];
    const userPlanIndex = planHierarchy.indexOf(req.user.subscription.plan);
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);

    if (userPlanIndex < requiredPlanIndex) {
      return res.status(403).json({ 
        message: `This feature requires ${requiredPlan} plan or higher` 
      });
    }

    if (!req.user.subscription.isActive) {
      return res.status(403).json({ 
        message: 'Subscription is not active' 
      });
    }

    next();
  };
};

// API Key authentication
const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ message: 'API key required' });
  }

  try {
    const user = await User.findOne({ 
      'apiAccess.apiKey': apiKey,
      'apiAccess.isEnabled': true,
      isActive: true
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    // Update last used timestamp
    user.apiAccess.lastUsed = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    logger.error('API key auth error:', error);
    return res.status(401).json({ message: 'Invalid API key' });
  }
};

module.exports = {
  protect,
  authorize,
  checkSubscription,
  apiKeyAuth
};
