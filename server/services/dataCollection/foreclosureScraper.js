const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const logger = require('../../utils/logger');
const Property = require('../../models/Property');

class ForeclosureScraper {
  constructor() {
    this.browser = null;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      logger.info('Browser initialized for foreclosure scraping');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async scrapeCountyRecords(county, state) {
    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.getRandomUserAgent());
      
      // Navigate to county records website
      const countyUrl = this.getCountyUrl(county, state);
      await page.goto(countyUrl, { waitUntil: 'networkidle2' });
      
      // Search for foreclosure records
      const foreclosureData = await this.extractForeclosureData(page);
      
      await page.close();
      return foreclosureData;
    } catch (error) {
      logger.error(`Error scraping county records for ${county}, ${state}:`, error);
      throw error;
    }
  }

  async scrapeForeclosureListings() {
    const listings = [];
    
    try {
      // Scrape multiple foreclosure listing sites
      const sites = [
        'https://www.foreclosure.com',
        'https://www.realtytrac.com',
        'https://www.auction.com'
      ];

      for (const site of sites) {
        try {
          const siteListings = await this.scrapeSite(site);
          listings.push(...siteListings);
        } catch (error) {
          logger.error(`Error scraping ${site}:`, error);
        }
      }

      return listings;
    } catch (error) {
      logger.error('Error scraping foreclosure listings:', error);
      throw error;
    }
  }

  async scrapeSite(url) {
    const page = await this.browser.newPage();
    await page.setUserAgent(this.getRandomUserAgent());
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Wait for content to load
      await page.waitForSelector('.property-listing, .foreclosure-item, .auction-item', { timeout: 10000 });
      
      const listings = await page.evaluate(() => {
        const items = document.querySelectorAll('.property-listing, .foreclosure-item, .auction-item');
        return Array.from(items).map(item => {
          return {
            address: item.querySelector('.address, .property-address')?.textContent?.trim(),
            price: item.querySelector('.price, .bid-amount')?.textContent?.trim(),
            status: item.querySelector('.status, .foreclosure-status')?.textContent?.trim(),
            auctionDate: item.querySelector('.auction-date, .sale-date')?.textContent?.trim(),
            details: item.querySelector('.details, .property-details')?.textContent?.trim()
          };
        });
      });
      
      await page.close();
      return listings;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async scrapePublicRecords(state, county) {
    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.getRandomUserAgent());
      
      // Navigate to public records search
      const searchUrl = this.getPublicRecordsUrl(state, county);
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Search for foreclosure-related documents
      await page.type('#search-input', 'foreclosure OR "notice of default" OR "trustee sale"');
      await page.click('#search-button');
      
      await page.waitForSelector('.search-results', { timeout: 10000 });
      
      const records = await page.evaluate(() => {
        const results = document.querySelectorAll('.search-result');
        return Array.from(results).map(result => {
          return {
            documentType: result.querySelector('.doc-type')?.textContent?.trim(),
            date: result.querySelector('.date')?.textContent?.trim(),
            propertyAddress: result.querySelector('.property-address')?.textContent?.trim(),
            caseNumber: result.querySelector('.case-number')?.textContent?.trim(),
            amount: result.querySelector('.amount')?.textContent?.trim()
          };
        });
      });
      
      await page.close();
      return records;
    } catch (error) {
      logger.error(`Error scraping public records for ${county}, ${state}:`, error);
      throw error;
    }
  }

  async scrapeMLSListings() {
    try {
      // This would integrate with MLS APIs
      // For now, we'll simulate MLS data
      const mlsData = await this.fetchMLSData();
      return mlsData;
    } catch (error) {
      logger.error('Error scraping MLS listings:', error);
      throw error;
    }
  }

  async fetchMLSData() {
    // Simulate MLS API call
    return [
      {
        mlsNumber: 'MLS123456',
        address: '123 Main St, Anytown, ST 12345',
        price: 250000,
        status: 'Active',
        daysOnMarket: 45,
        propertyType: 'Single Family',
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1500
      }
    ];
  }

  async scrapeTaxRecords(county, state) {
    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.getRandomUserAgent());
      
      const taxUrl = this.getTaxRecordsUrl(county, state);
      await page.goto(taxUrl, { waitUntil: 'networkidle2' });
      
      // Search for delinquent tax properties
      const delinquentProperties = await page.evaluate(() => {
        const properties = document.querySelectorAll('.tax-property');
        return Array.from(properties).map(prop => {
          return {
            address: prop.querySelector('.address')?.textContent?.trim(),
            owner: prop.querySelector('.owner')?.textContent?.trim(),
            assessedValue: prop.querySelector('.assessed-value')?.textContent?.trim(),
            delinquentAmount: prop.querySelector('.delinquent-amount')?.textContent?.trim(),
            yearsDelinquent: prop.querySelector('.years-delinquent')?.textContent?.trim()
          };
        });
      });
      
      await page.close();
      return delinquentProperties;
    } catch (error) {
      logger.error(`Error scraping tax records for ${county}, ${state}:`, error);
      throw error;
    }
  }

  async processAndSaveData(rawData, source) {
    try {
      const processedProperties = [];
      
      for (const item of rawData) {
        try {
          const property = await this.processPropertyData(item, source);
          if (property) {
            // Check if property already exists
            const existingProperty = await Property.findOne({
              'address.street': property.address.street,
              'address.city': property.address.city,
              'address.state': property.address.state
            });
            
            if (!existingProperty) {
              const savedProperty = await Property.create(property);
              processedProperties.push(savedProperty);
              logger.info(`Saved new property: ${property.address.street}`);
            } else {
              // Update existing property
              await Property.findByIdAndUpdate(existingProperty._id, property);
              logger.info(`Updated existing property: ${property.address.street}`);
            }
          }
        } catch (error) {
          logger.error('Error processing property data:', error);
        }
      }
      
      return processedProperties;
    } catch (error) {
      logger.error('Error processing and saving data:', error);
      throw error;
    }
  }

  async processPropertyData(item, source) {
    try {
      // Parse address
      const address = this.parseAddress(item.address);
      if (!address) return null;
      
      // Parse price
      const price = this.parsePrice(item.price);
      
      // Parse foreclosure status
      const status = this.parseForeclosureStatus(item.status);
      
      // Parse auction date
      const auctionDate = this.parseDate(item.auctionDate);
      
      return {
        address: address,
        foreclosureStatus: status,
        foreclosureDetails: {
          openingBid: price,
          auctionDate: auctionDate,
          lender: item.lender || 'Unknown'
        },
        leadInfo: {
          source: source,
          dateFound: new Date()
        },
        dataQuality: {
          completeness: this.calculateCompleteness(item),
          accuracy: 75 // Default accuracy
        }
      };
    } catch (error) {
      logger.error('Error processing property data:', error);
      return null;
    }
  }

  parseAddress(addressString) {
    if (!addressString) return null;
    
    // Simple address parsing - in production, use a more robust parser
    const parts = addressString.split(',').map(part => part.trim());
    
    if (parts.length < 3) return null;
    
    return {
      street: parts[0],
      city: parts[1],
      state: parts[2].split(' ')[0],
      zipCode: parts[2].split(' ')[1] || ''
    };
  }

  parsePrice(priceString) {
    if (!priceString) return null;
    
    const cleaned = priceString.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || null;
  }

  parseForeclosureStatus(statusString) {
    if (!statusString) return 'Pre-Foreclosure';
    
    const status = statusString.toLowerCase();
    if (status.includes('auction')) return 'Auction';
    if (status.includes('reo') || status.includes('bank owned')) return 'REO';
    if (status.includes('sold')) return 'Sold';
    return 'Pre-Foreclosure';
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      return new Date(dateString);
    } catch (error) {
      return null;
    }
  }

  calculateCompleteness(item) {
    let score = 0;
    if (item.address) score += 25;
    if (item.price) score += 25;
    if (item.status) score += 25;
    if (item.auctionDate) score += 25;
    return score;
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getCountyUrl(county, state) {
    // This would map to actual county websites
    return `https://${county.toLowerCase().replace(/\s+/g, '')}.${state.toLowerCase()}.gov/records`;
  }

  getPublicRecordsUrl(state, county) {
    return `https://publicrecords.${state.toLowerCase()}.gov/search`;
  }

  getTaxRecordsUrl(county, state) {
    return `https://${county.toLowerCase().replace(/\s+/g, '')}.${state.toLowerCase()}.gov/tax-records`;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      logger.info('Browser closed');
    }
  }
}

module.exports = ForeclosureScraper;
