const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

class AuthController {
  // Generate JWT token
  generateToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  }

  // Register new user
  async register(req, res) {
    try {
      const { firstName, lastName, email, password, phone, company } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Create user
      const user = await User.create({
        firstName,
        lastName,
        email,
        password,
        phone,
        profile: { company }
      });

      // Generate token
      const token = this.generateToken(user._id);

      // Update user activity
      await user.updateActivity();

      res.status(201).json({
        success: true,
        token,
        data: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          subscription: user.subscription
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration'
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = this.generateToken(user._id);

      // Update user activity
      await user.updateActivity();

      res.json({
        success: true,
        token,
        data: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          subscription: user.subscription,
          preferences: user.preferences
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login'
      });
    }
  }

  // Get current user
  async getMe(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('team.teamId', 'name');

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Get me error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const allowedUpdates = [
        'firstName', 'lastName', 'phone', 'profile', 'preferences'
      ];
      
      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findById(req.user._id).select('+password');

      // Check current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(20).toString('hex');

      // Set reset token and expiry
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

      await user.save();

      // In production, send email with reset link
      logger.info(`Password reset token for ${email}: ${resetToken}`);

      res.json({
        success: true,
        message: 'Password reset token sent to email'
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Update password
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Generate API key
  async generateApiKey(req, res) {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user.apiAccess.isEnabled) {
        return res.status(403).json({
          success: false,
          message: 'API access is not enabled for your account'
        });
      }

      const apiKey = user.generateApiKey();
      await user.save();

      res.json({
        success: true,
        data: { apiKey }
      });
    } catch (error) {
      logger.error('Generate API key error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Logout (client-side token removal)
  async logout(req, res) {
    try {
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
}

module.exports = new AuthController();
