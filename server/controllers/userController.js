const User = require('../models/User');
const logger = require('../utils/logger');

class UserController {
  // Get all users (Admin only)
  async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        subscription,
        isActive,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (role) filter.role = role;
      if (subscription) filter['subscription.plan'] = subscription;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      
      if (search) {
        filter.$or = [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
          { 'profile.company': new RegExp(search, 'i') }
        ];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const users = await User.find(filter)
        .select('-password -verificationToken -passwordResetToken')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await User.countDocuments(filter);

      res.json({
        success: true,
        data: users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } catch (error) {
      logger.error('Error getting users:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get single user by ID
  async getUser(req, res) {
    try {
      const user = await User.findById(req.params.id)
        .select('-password -verificationToken -passwordResetToken')
        .populate('team.teamId', 'name');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Check if user has access to this user's data
      if (req.user.role !== 'Admin' && req.user._id.toString() !== req.params.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      res.json({ success: true, data: user });
    } catch (error) {
      logger.error('Error getting user:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update user
  async updateUser(req, res) {
    try {
      const userId = req.params.id;
      const updates = req.body;

      // Check if user has access to update this user
      if (req.user.role !== 'Admin' && req.user._id.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Remove sensitive fields that shouldn't be updated directly
      delete updates.password;
      delete updates.verificationToken;
      delete updates.passwordResetToken;
      delete updates.apiAccess.apiKey;

      // Only admins can update role and subscription
      if (req.user.role !== 'Admin') {
        delete updates.role;
        delete updates.subscription;
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { ...updates, updatedBy: req.user._id },
        { new: true, runValidators: true }
      ).select('-password -verificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, data: user });
    } catch (error) {
      logger.error('Error updating user:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Delete user (soft delete)
  async deleteUser(req, res) {
    try {
      const userId = req.params.id;

      // Only admins can delete users
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Prevent admin from deleting themselves
      if (req.user._id.toString() === userId) {
        return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { isActive: false, updatedBy: req.user._id },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Error deleting user:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update user subscription
  async updateSubscription(req, res) {
    try {
      const userId = req.params.id;
      const { plan, isActive, startDate, endDate } = req.body;

      // Only admins can update subscriptions
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update subscription
      user.subscription.plan = plan;
      user.subscription.isActive = isActive;
      if (startDate) user.subscription.startDate = new Date(startDate);
      if (endDate) user.subscription.endDate = new Date(endDate);

      await user.save();

      res.json({ success: true, data: user.subscription });
    } catch (error) {
      logger.error('Error updating subscription:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Generate API key for user
  async generateApiKey(req, res) {
    try {
      const userId = req.params.id;

      // Check if user has access
      if (req.user.role !== 'Admin' && req.user._id.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Enable API access if not already enabled
      if (!user.apiAccess.isEnabled) {
        user.apiAccess.isEnabled = true;
      }

      const apiKey = user.generateApiKey();
      await user.save();

      res.json({ success: true, data: { apiKey } });
    } catch (error) {
      logger.error('Error generating API key:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get user analytics
  async getUserAnalytics(req, res) {
    try {
      const { timeRange = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

      // Get analytics data
      const [
        totalUsers,
        activeUsers,
        newUsers,
        roleBreakdown,
        subscriptionBreakdown,
        userActivity
      ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ createdAt: { $gte: startDate } }),
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        User.aggregate([
          { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
        ]),
        User.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          newUsers,
          roleBreakdown,
          subscriptionBreakdown,
          userActivity
        }
      });
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Bulk update users
  async bulkUpdateUsers(req, res) {
    try {
      const { userIds, updates } = req.body;

      // Only admins can bulk update users
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, message: 'User IDs are required' });
      }

      // Remove sensitive fields
      delete updates.password;
      delete updates.verificationToken;
      delete updates.passwordResetToken;

      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { ...updates, updatedBy: req.user._id }
      );

      res.json({
        success: true,
        message: `Updated ${result.modifiedCount} users`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      logger.error('Error bulk updating users:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Export users
  async exportUsers(req, res) {
    try {
      const { format = 'csv', ...filters } = req.query;

      // Only admins can export users
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Build filter object
      const filter = {};
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          if (key === 'role') filter.role = filters[key];
          else if (key === 'subscription') filter['subscription.plan'] = filters[key];
          else if (key === 'isActive') filter.isActive = filters[key] === 'true';
        }
      });

      const users = await User.find(filter)
        .select('-password -verificationToken -passwordResetToken -apiAccess.apiKey')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        const csv = this.convertToCSV(users);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
        res.send(csv);
      } else {
        res.json({ success: true, data: users });
      }
    } catch (error) {
      logger.error('Error exporting users:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Convert users to CSV
  convertToCSV(users) {
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Company',
      'Role',
      'Subscription Plan',
      'Subscription Status',
      'Is Active',
      'Created Date',
      'Last Login'
    ];

    const rows = users.map(user => [
      user.firstName,
      user.lastName,
      user.email,
      user.phone || '',
      user.profile?.company || '',
      user.role,
      user.subscription.plan,
      user.subscription.isActive ? 'Active' : 'Inactive',
      user.isActive ? 'Yes' : 'No',
      user.createdAt.toISOString().split('T')[0],
      user.activity?.lastLogin ? user.activity.lastLogin.toISOString().split('T')[0] : 'Never'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = new UserController();
