const cron = require('node-cron');
const logger = require('../../utils/logger');
const ForeclosureScraper = require('../dataCollection/foreclosureScraper');
const DataProcessor = require('../dataCollection/dataProcessor');

class DataCollectionScheduler {
  constructor() {
    this.scraper = new ForeclosureScraper();
    this.processor = new DataProcessor();
    this.isRunning = false;
    this.jobs = new Map();
  }

  async initialize() {
    try {
      await this.scraper.initialize();
      logger.info('Data collection scheduler initialized');
    } catch (error) {
      logger.error('Failed to initialize data collection scheduler:', error);
      throw error;
    }
  }

  startScheduledJobs() {
    try {
      // Daily foreclosure data collection at 6 AM
      this.scheduleJob('daily-foreclosure-scrape', '0 6 * * *', async () => {
        await this.runForeclosureDataCollection();
      });

      // Hourly data enrichment for new properties
      this.scheduleJob('hourly-enrichment', '0 * * * *', async () => {
        await this.runDataEnrichment();
      });

      // Weekly market data update on Sundays at 2 AM
      this.scheduleJob('weekly-market-update', '0 2 * * 0', async () => {
        await this.runMarketDataUpdate();
      });

      // Daily lead scoring update at 8 PM
      this.scheduleJob('daily-lead-scoring', '0 20 * * *', async () => {
        await this.runLeadScoringUpdate();
      });

      logger.info('Scheduled jobs started');
    } catch (error) {
      logger.error('Error starting scheduled jobs:', error);
    }
  }

  scheduleJob(name, cronExpression, task) {
    if (this.jobs.has(name)) {
      this.jobs.get(name).destroy();
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`Starting scheduled job: ${name}`);
        await task();
        logger.info(`Completed scheduled job: ${name}`);
      } catch (error) {
        logger.error(`Error in scheduled job ${name}:`, error);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    this.jobs.set(name, job);
    logger.info(`Scheduled job ${name} with expression: ${cronExpression}`);
  }

  async runForeclosureDataCollection() {
    if (this.isRunning) {
      logger.warn('Foreclosure data collection already running, skipping...');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting foreclosure data collection...');

      // Define target counties and states
      const targetAreas = [
        { county: 'Los Angeles', state: 'CA' },
        { county: 'Miami-Dade', state: 'FL' },
        { county: 'Harris', state: 'TX' },
        { county: 'Maricopa', state: 'AZ' },
        { county: 'Cook', state: 'IL' }
      ];

      let totalProperties = 0;

      for (const area of targetAreas) {
        try {
          logger.info(`Collecting data for ${area.county}, ${area.state}...`);
          
          // Scrape county records
          const countyData = await this.scraper.scrapeCountyRecords(area.county, area.state);
          const countyProperties = await this.scraper.processAndSaveData(countyData, 'County Records');
          totalProperties += countyProperties.length;

          // Scrape public records
          const publicRecords = await this.scraper.scrapePublicRecords(area.state, area.county);
          const publicProperties = await this.scraper.processAndSaveData(publicRecords, 'Public Records');
          totalProperties += publicProperties.length;

          // Scrape tax records
          const taxRecords = await this.scraper.scrapeTaxRecords(area.county, area.state);
          const taxProperties = await this.scraper.processAndSaveData(taxRecords, 'Tax Records');
          totalProperties += taxProperties.length;

          logger.info(`Collected ${countyProperties.length + publicProperties.length + taxProperties.length} properties for ${area.county}, ${area.state}`);
        } catch (error) {
          logger.error(`Error collecting data for ${area.county}, ${area.state}:`, error);
        }
      }

      // Scrape foreclosure listing sites
      const listingData = await this.scraper.scrapeForeclosureListings();
      const listingProperties = await this.scraper.processAndSaveData(listingData, 'Foreclosure Listings');
      totalProperties += listingProperties.length;

      logger.info(`Foreclosure data collection completed. Total properties collected: ${totalProperties}`);
    } catch (error) {
      logger.error('Error in foreclosure data collection:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runDataEnrichment() {
    try {
      logger.info('Starting data enrichment...');

      // Find properties that need enrichment (low data quality or missing key fields)
      const Property = require('../../models/Property');
      const propertiesToEnrich = await Property.find({
        isActive: true,
        $or: [
          { 'dataQuality.completeness': { $lt: 70 } },
          { 'address.coordinates': { $exists: false } },
          { 'financials.currentValue': { $exists: false } }
        ]
      }).limit(50); // Process 50 properties at a time

      if (propertiesToEnrich.length === 0) {
        logger.info('No properties need enrichment');
        return;
      }

      const results = await this.processor.batchProcessProperties(propertiesToEnrich);
      logger.info(`Data enrichment completed. Processed: ${results.processed}, Enriched: ${results.enriched}, Leads: ${results.leadsGenerated}, Errors: ${results.errors}`);
    } catch (error) {
      logger.error('Error in data enrichment:', error);
    }
  }

  async runMarketDataUpdate() {
    try {
      logger.info('Starting market data update...');

      const Property = require('../../models/Property');
      const properties = await Property.find({
        isActive: true,
        'marketData.lastUpdated': { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Older than 7 days
      }).limit(100);

      for (const property of properties) {
        try {
          const marketData = await this.processor.getMarketData(property.address);
          if (marketData) {
            property.marketData = { ...property.marketData, ...marketData, lastUpdated: new Date() };
            await property.save();
          }
        } catch (error) {
          logger.error(`Error updating market data for property ${property._id}:`, error);
        }
      }

      logger.info(`Market data update completed for ${properties.length} properties`);
    } catch (error) {
      logger.error('Error in market data update:', error);
    }
  }

  async runLeadScoringUpdate() {
    try {
      logger.info('Starting lead scoring update...');

      const Lead = require('../../models/Lead');
      const leads = await Lead.find({
        isActive: true,
        status: { $nin: ['Closed', 'Lost'] }
      });

      for (const lead of leads) {
        try {
          // Recalculate lead score based on current data
          const property = await require('../../models/Property').findById(lead.property);
          if (property) {
            lead.score.factors.motivation = this.processor.scoreMotivation(property);
            lead.score.factors.timeline = this.processor.scoreTimeline(property);
            lead.score.factors.equity = this.processor.scoreEquity(property);
            lead.score.factors.condition = this.processor.scoreCondition(property);
            lead.score.total = Object.values(lead.score.factors).reduce((sum, score) => sum + score, 0);
            await lead.save();
          }
        } catch (error) {
          logger.error(`Error updating lead score for lead ${lead._id}:`, error);
        }
      }

      logger.info(`Lead scoring update completed for ${leads.length} leads`);
    } catch (error) {
      logger.error('Error in lead scoring update:', error);
    }
  }

  async runManualDataCollection(areas = []) {
    try {
      logger.info('Starting manual data collection...');

      if (areas.length === 0) {
        areas = [
          { county: 'Los Angeles', state: 'CA' },
          { county: 'Miami-Dade', state: 'FL' }
        ];
      }

      let totalProperties = 0;

      for (const area of areas) {
        try {
          const countyData = await this.scraper.scrapeCountyRecords(area.county, area.state);
          const properties = await this.scraper.processAndSaveData(countyData, 'Manual Collection');
          totalProperties += properties.length;
        } catch (error) {
          logger.error(`Error in manual collection for ${area.county}, ${area.state}:`, error);
        }
      }

      logger.info(`Manual data collection completed. Total properties: ${totalProperties}`);
      return { success: true, totalProperties };
    } catch (error) {
      logger.error('Error in manual data collection:', error);
      throw error;
    }
  }

  stopScheduledJobs() {
    this.jobs.forEach((job, name) => {
      job.destroy();
      logger.info(`Stopped scheduled job: ${name}`);
    });
    this.jobs.clear();
  }

  async shutdown() {
    try {
      this.stopScheduledJobs();
      await this.scraper.close();
      logger.info('Data collection scheduler shutdown complete');
    } catch (error) {
      logger.error('Error during scheduler shutdown:', error);
    }
  }

  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });
    return status;
  }
}

module.exports = DataCollectionScheduler;
