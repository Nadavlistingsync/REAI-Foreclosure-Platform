const axios = require('axios');
const logger = require('../../utils/logger');
const Property = require('../../models/Property');
const Lead = require('../../models/Lead');

class DataProcessor {
  constructor() {
    this.apiKeys = {
      googleMaps: process.env.GOOGLE_MAPS_API_KEY,
      zillow: process.env.ZILLOW_API_KEY,
      openai: process.env.OPENAI_API_KEY
    };
  }

  async enrichPropertyData(property) {
    try {
      logger.info(`Enriching data for property: ${property.address.street}`);
      
      // Get coordinates
      const coordinates = await this.getCoordinates(property.address);
      if (coordinates) {
        property.address.coordinates = coordinates;
      }
      
      // Get property details from Zillow
      const zillowData = await this.getZillowData(property.address);
      if (zillowData) {
        this.mergeZillowData(property, zillowData);
      }
      
      // Get market data
      const marketData = await this.getMarketData(property.address);
      if (marketData) {
        property.marketData = marketData;
      }
      
      // Calculate financial metrics
      this.calculateFinancialMetrics(property);
      
      // Update data quality
      this.updateDataQuality(property);
      
      await property.save();
      logger.info(`Successfully enriched property: ${property.address.street}`);
      
      return property;
    } catch (error) {
      logger.error(`Error enriching property data: ${error.message}`);
      throw error;
    }
  }

  async getCoordinates(address) {
    try {
      if (!this.apiKeys.googleMaps) {
        logger.warn('Google Maps API key not configured');
        return null;
      }
      
      const addressString = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: addressString,
          key: this.apiKeys.googleMaps
        }
      });
      
      if (response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting coordinates:', error.message);
      return null;
    }
  }

  async getZillowData(address) {
    try {
      if (!this.apiKeys.zillow) {
        logger.warn('Zillow API key not configured');
        return null;
      }
      
      // Note: Zillow API is deprecated, this is a placeholder for alternative services
      // In production, use services like RentSpree, RentBerry, or Rentberry
      const addressString = `${address.street}, ${address.city}, ${address.state}`;
      
      // Simulate Zillow data for demo purposes
      return {
        zpid: '12345678',
        homeType: 'SINGLE_FAMILY',
        yearBuilt: 1995,
        lotSize: 8000,
        livingArea: 1500,
        bedrooms: 3,
        bathrooms: 2,
        zestimate: 250000,
        rentZestimate: 1800
      };
    } catch (error) {
      logger.error('Error getting Zillow data:', error.message);
      return null;
    }
  }

  mergeZillowData(property, zillowData) {
    if (zillowData.yearBuilt) property.yearBuilt = zillowData.yearBuilt;
    if (zillowData.lotSize) property.lotSize = zillowData.lotSize;
    if (zillowData.livingArea) property.squareFeet = zillowData.livingArea;
    if (zillowData.bedrooms) property.bedrooms = zillowData.bedrooms;
    if (zillowData.bathrooms) property.bathrooms = zillowData.bathrooms;
    if (zillowData.zestimate) property.financials.currentValue = zillowData.zestimate;
    if (zillowData.rentZestimate) property.financials.rentalIncome = zillowData.rentZestimate;
  }

  async getMarketData(address) {
    try {
      // Get comparable sales and market statistics
      const comparables = await this.getComparableSales(address);
      const neighborhoodStats = await this.getNeighborhoodStats(address);
      
      return {
        comparableSales: comparables,
        neighborhoodStats: neighborhoodStats,
        daysOnMarket: this.calculateDaysOnMarket(comparables),
        pricePerSqFt: this.calculatePricePerSqFt(comparables)
      };
    } catch (error) {
      logger.error('Error getting market data:', error.message);
      return null;
    }
  }

  async getComparableSales(address) {
    try {
      // In production, this would query MLS or other data sources
      // For demo purposes, return simulated data
      return [
        {
          address: '125 Main St, Anytown, ST 12345',
          salePrice: 245000,
          saleDate: new Date('2023-08-15'),
          squareFeet: 1450,
          distance: 0.2
        },
        {
          address: '127 Main St, Anytown, ST 12345',
          salePrice: 255000,
          saleDate: new Date('2023-07-20'),
          squareFeet: 1550,
          distance: 0.3
        }
      ];
    } catch (error) {
      logger.error('Error getting comparable sales:', error.message);
      return [];
    }
  }

  async getNeighborhoodStats(address) {
    try {
      // In production, this would query market data APIs
      return {
        medianPrice: 250000,
        averageDaysOnMarket: 45,
        pricePerSqFt: 165,
        inventory: 12
      };
    } catch (error) {
      logger.error('Error getting neighborhood stats:', error.message);
      return null;
    }
  }

  calculateFinancialMetrics(property) {
    try {
      const currentValue = property.financials.currentValue;
      const repairCosts = property.financials.repairCosts || 0;
      const openingBid = property.foreclosureDetails.openingBid || 0;
      
      if (currentValue && repairCosts) {
        property.financials.afterRepairValue = currentValue;
        property.financials.maximumAllowableOffer = currentValue - repairCosts - 20000; // 20k profit buffer
      }
      
      if (property.financials.rentalIncome && currentValue) {
        property.financials.capRate = (property.financials.rentalIncome * 12 / currentValue) * 100;
      }
      
      // Calculate estimated profit
      if (property.financials.afterRepairValue && repairCosts && openingBid) {
        property.financials.roi = ((property.financials.afterRepairValue - repairCosts - openingBid) / openingBid) * 100;
      }
    } catch (error) {
      logger.error('Error calculating financial metrics:', error.message);
    }
  }

  updateDataQuality(property) {
    let completeness = 0;
    let accuracy = 75; // Base accuracy
    
    // Check completeness
    if (property.address.street) completeness += 10;
    if (property.address.city) completeness += 10;
    if (property.address.state) completeness += 10;
    if (property.address.zipCode) completeness += 10;
    if (property.propertyType) completeness += 10;
    if (property.foreclosureStatus) completeness += 10;
    if (property.foreclosureDetails.lender) completeness += 10;
    if (property.owner.name) completeness += 10;
    if (property.financials.currentValue) completeness += 10;
    if (property.condition) completeness += 10;
    
    // Adjust accuracy based on data sources
    if (property.address.coordinates) accuracy += 5;
    if (property.marketData && property.marketData.comparableSales.length > 0) accuracy += 10;
    if (property.financials.currentValue) accuracy += 10;
    
    property.dataQuality.completeness = completeness;
    property.dataQuality.accuracy = Math.min(accuracy, 100);
    property.dataQuality.lastVerified = new Date();
  }

  calculateDaysOnMarket(comparables) {
    if (!comparables || comparables.length === 0) return null;
    
    const totalDays = comparables.reduce((sum, comp) => {
      const days = Math.floor((new Date() - comp.saleDate) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    
    return Math.floor(totalDays / comparables.length);
  }

  calculatePricePerSqFt(comparables) {
    if (!comparables || comparables.length === 0) return null;
    
    const validComparables = comparables.filter(comp => comp.squareFeet && comp.squareFeet > 0);
    if (validComparables.length === 0) return null;
    
    const totalPricePerSqFt = validComparables.reduce((sum, comp) => {
      return sum + (comp.salePrice / comp.squareFeet);
    }, 0);
    
    return Math.floor(totalPricePerSqFt / validComparables.length);
  }

  async generateLead(property) {
    try {
      // Check if lead already exists
      const existingLead = await Lead.findOne({ property: property._id });
      if (existingLead) {
        return existingLead;
      }
      
      // Create new lead
      const leadData = {
        property: property._id,
        source: property.leadInfo.source,
        contact: {
          name: property.owner.name || 'Unknown',
          phone: property.owner.contactInfo?.phone,
          email: property.owner.contactInfo?.email
        },
        details: {
          motivation: this.determineMotivation(property),
          timeline: this.determineTimeline(property),
          askingPrice: property.foreclosureDetails.openingBid,
          condition: property.condition
        },
        score: {
          factors: {
            motivation: this.scoreMotivation(property),
            timeline: this.scoreTimeline(property),
            equity: this.scoreEquity(property),
            condition: this.scoreCondition(property)
          }
        }
      };
      
      const lead = await Lead.create(leadData);
      logger.info(`Generated lead for property: ${property.address.street}`);
      
      return lead;
    } catch (error) {
      logger.error('Error generating lead:', error.message);
      throw error;
    }
  }

  determineMotivation(property) {
    if (property.foreclosureStatus === 'Pre-Foreclosure') return 'Financial Distress';
    if (property.taxInfo.taxDelinquent) return 'Financial Distress';
    if (property.owner.isAbsenteeOwner) return 'Investment';
    return 'Other';
  }

  determineTimeline(property) {
    if (property.foreclosureDetails.auctionDate) {
      const daysUntilAuction = Math.floor((property.foreclosureDetails.auctionDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilAuction < 30) return 'Immediate';
      if (daysUntilAuction < 90) return '1-3 Months';
      return '3-6 Months';
    }
    return 'Flexible';
  }

  scoreMotivation(property) {
    let score = 0;
    if (property.foreclosureStatus === 'Pre-Foreclosure') score += 15;
    if (property.taxInfo.taxDelinquent) score += 10;
    if (property.owner.isAbsenteeOwner) score += 5;
    return Math.min(score, 25);
  }

  scoreTimeline(property) {
    if (property.foreclosureDetails.auctionDate) {
      const daysUntilAuction = Math.floor((property.foreclosureDetails.auctionDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilAuction < 30) return 25;
      if (daysUntilAuction < 90) return 20;
      if (daysUntilAuction < 180) return 15;
      return 10;
    }
    return 15;
  }

  scoreEquity(property) {
    if (property.foreclosureDetails.estimatedEquity) {
      const equity = property.foreclosureDetails.estimatedEquity;
      if (equity > 100000) return 25;
      if (equity > 50000) return 20;
      if (equity > 25000) return 15;
      if (equity > 0) return 10;
    }
    return 5;
  }

  scoreCondition(property) {
    const conditionScores = {
      'Excellent': 25,
      'Good': 20,
      'Fair': 15,
      'Poor': 10,
      'Unknown': 5
    };
    return conditionScores[property.condition] || 5;
  }

  async batchProcessProperties(properties) {
    try {
      const results = {
        processed: 0,
        enriched: 0,
        leadsGenerated: 0,
        errors: 0
      };
      
      for (const property of properties) {
        try {
          await this.enrichPropertyData(property);
          results.enriched++;
          
          const lead = await this.generateLead(property);
          if (lead) results.leadsGenerated++;
          
          results.processed++;
        } catch (error) {
          logger.error(`Error processing property ${property._id}:`, error.message);
          results.errors++;
        }
      }
      
      logger.info(`Batch processing completed: ${JSON.stringify(results)}`);
      return results;
    } catch (error) {
      logger.error('Error in batch processing:', error.message);
      throw error;
    }
  }
}

module.exports = DataProcessor;
