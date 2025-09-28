const logger = require('../utils/logger');
const DataCollectionScheduler = require('../services/automation/dataCollectionScheduler');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

class AutomationController {
  constructor() {
    this.scheduler = new DataCollectionScheduler();
    this.emailTransporter = null;
    this.twilioClient = null;
    this.initializeServices();
  }

  async initializeServices() {
    try {
      // Initialize email service
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.emailTransporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        logger.info('Email service initialized');
      }

      // Initialize SMS service
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        logger.info('SMS service initialized');
      }
    } catch (error) {
      logger.error('Error initializing automation services:', error);
    }
  }

  // Get automation status and settings
  async getAutomationStatus(req, res) {
    try {
      const status = {
        dataCollection: {
          isRunning: this.scheduler.isRunning,
          jobs: this.scheduler.getJobStatus(),
          lastRun: new Date().toISOString()
        },
        email: {
          enabled: !!this.emailTransporter,
          configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER)
        },
        sms: {
          enabled: !!this.twilioClient,
          configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        }
      };

      res.json({ success: true, data: status });
    } catch (error) {
      logger.error('Error getting automation status:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Trigger manual data collection
  async triggerDataCollection(req, res) {
    try {
      const { areas = [] } = req.body;

      if (this.scheduler.isRunning) {
        return res.status(400).json({ 
          success: false, 
          message: 'Data collection is already running' 
        });
      }

      // Start data collection in background
      this.scheduler.runManualDataCollection(areas)
        .then(result => {
          logger.info('Manual data collection completed:', result);
        })
        .catch(error => {
          logger.error('Manual data collection failed:', error);
        });

      res.json({ 
        success: true, 
        message: 'Data collection started',
        data: { areas: areas.length > 0 ? areas : 'All configured areas' }
      });
    } catch (error) {
      logger.error('Error triggering data collection:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Send email notification
  async sendEmailNotification(req, res) {
    try {
      const { to, subject, body, type = 'general' } = req.body;

      if (!this.emailTransporter) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email service not configured' 
        });
      }

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: to,
        subject: subject,
        html: this.formatEmailBody(body, type)
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}: ${subject}`);

      res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
      logger.error('Error sending email:', error);
      res.status(500).json({ success: false, message: 'Failed to send email' });
    }
  }

  // Send SMS notification
  async sendSMSNotification(req, res) {
    try {
      const { to, message } = req.body;

      if (!this.twilioClient) {
        return res.status(400).json({ 
          success: false, 
          message: 'SMS service not configured' 
        });
      }

      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      logger.info(`SMS sent to ${to}`);
      res.json({ success: true, message: 'SMS sent successfully' });
    } catch (error) {
      logger.error('Error sending SMS:', error);
      res.status(500).json({ success: false, message: 'Failed to send SMS' });
    }
  }

  // Create automated workflow
  async createWorkflow(req, res) {
    try {
      const { name, triggers, actions, isActive = true } = req.body;

      // Validate workflow configuration
      if (!name || !triggers || !actions) {
        return res.status(400).json({ 
          success: false, 
          message: 'Workflow name, triggers, and actions are required' 
        });
      }

      // Store workflow configuration (in production, this would be saved to database)
      const workflow = {
        id: Date.now().toString(),
        name,
        triggers,
        actions,
        isActive,
        createdBy: req.user._id,
        createdAt: new Date()
      };

      // Register workflow with scheduler
      this.registerWorkflow(workflow);

      logger.info(`Workflow created: ${name}`);
      res.status(201).json({ success: true, data: workflow });
    } catch (error) {
      logger.error('Error creating workflow:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get workflows
  async getWorkflows(req, res) {
    try {
      // In production, this would fetch from database
      const workflows = [
        {
          id: '1',
          name: 'New Lead Notification',
          triggers: [{ type: 'new_lead', conditions: { priority: 'High' } }],
          actions: [
            { type: 'email', config: { template: 'new_lead_alert' } },
            { type: 'sms', config: { template: 'new_lead_sms' } }
          ],
          isActive: true,
          createdAt: new Date()
        },
        {
          id: '2',
          name: 'Follow-up Reminder',
          triggers: [{ type: 'scheduled', config: { interval: 'daily' } }],
          actions: [
            { type: 'email', config: { template: 'follow_up_reminder' } }
          ],
          isActive: true,
          createdAt: new Date()
        }
      ];

      res.json({ success: true, data: workflows });
    } catch (error) {
      logger.error('Error getting workflows:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Execute workflow
  async executeWorkflow(req, res) {
    try {
      const { workflowId, data } = req.body;

      // Find workflow
      const workflow = this.getWorkflowById(workflowId);
      if (!workflow) {
        return res.status(404).json({ 
          success: false, 
          message: 'Workflow not found' 
        });
      }

      // Execute workflow actions
      const results = await this.executeWorkflowActions(workflow.actions, data);

      logger.info(`Workflow ${workflowId} executed successfully`);
      res.json({ success: true, data: { results } });
    } catch (error) {
      logger.error('Error executing workflow:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get automation analytics
  async getAutomationAnalytics(req, res) {
    try {
      const { timeRange = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

      // In production, this would fetch from database
      const analytics = {
        dataCollection: {
          totalRuns: 45,
          successfulRuns: 42,
          failedRuns: 3,
          averageRunTime: '2.5 minutes',
          lastRun: new Date().toISOString()
        },
        notifications: {
          emailsSent: 156,
          smsSent: 23,
          deliveryRate: 98.5,
          openRate: 45.2
        },
        workflows: {
          totalWorkflows: 5,
          activeWorkflows: 4,
          executionsToday: 12,
          averageExecutionTime: '1.2 seconds'
        }
      };

      res.json({ success: true, data: analytics });
    } catch (error) {
      logger.error('Error getting automation analytics:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Helper methods
  formatEmailBody(body, type) {
    const templates = {
      general: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">REAI Platform Notification</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
            ${body}
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated message from the REAI Foreclosure Investment Platform.
          </p>
        </div>
      `,
      new_lead: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">New High-Priority Lead Alert</h2>
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; border-left: 4px solid #ffc107;">
            ${body}
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/leads" 
               style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Lead Details
            </a>
          </p>
        </div>
      `
    };

    return templates[type] || templates.general;
  }

  registerWorkflow(workflow) {
    // In production, this would register the workflow with the scheduler
    logger.info(`Workflow registered: ${workflow.name}`);
  }

  getWorkflowById(workflowId) {
    // In production, this would fetch from database
    return {
      id: workflowId,
      name: 'Sample Workflow',
      actions: []
    };
  }

  async executeWorkflowActions(actions, data) {
    const results = [];
    
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'email':
            if (this.emailTransporter) {
              await this.emailTransporter.sendMail({
                from: process.env.SMTP_USER,
                to: data.email,
                subject: action.config.subject || 'REAI Platform Notification',
                html: this.formatEmailBody(data.message, action.config.template)
              });
              results.push({ type: 'email', status: 'success' });
            }
            break;
          case 'sms':
            if (this.twilioClient) {
              await this.twilioClient.messages.create({
                body: data.message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: data.phone
              });
              results.push({ type: 'sms', status: 'success' });
            }
            break;
          default:
            results.push({ type: action.type, status: 'skipped' });
        }
      } catch (error) {
        logger.error(`Error executing action ${action.type}:`, error);
        results.push({ type: action.type, status: 'failed', error: error.message });
      }
    }

    return results;
  }
}

module.exports = new AutomationController();
