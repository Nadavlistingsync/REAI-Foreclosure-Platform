const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../server/models/User');
const Property = require('../server/models/Property');
const Lead = require('../server/models/Lead');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/foreclosure_platform');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Property.deleteMany({});
    await Lead.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create admin user
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@reai.com',
      password: 'admin123',
      role: 'Admin',
      subscription: {
        plan: 'Enterprise',
        isActive: true
      },
      isVerified: true
    });
    console.log('👤 Created admin user');

    // Create sample users
    const users = await User.create([
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'Investor',
        subscription: {
          plan: 'Professional',
          isActive: true
        },
        isVerified: true
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'Agent',
        subscription: {
          plan: 'Basic',
          isActive: true
        },
        isVerified: true
      }
    ]);
    console.log('👥 Created sample users');

    // Create sample properties
    const properties = await Property.create([
      {
        address: {
          street: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          county: 'Los Angeles'
        },
        propertyType: 'Single Family',
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1500,
        yearBuilt: 1995,
        foreclosureStatus: 'Pre-Foreclosure',
        foreclosureDetails: {
          noticeOfDefaultDate: new Date('2024-01-15'),
          auctionDate: new Date('2024-03-15'),
          openingBid: 250000,
          lender: 'Bank of America',
          estimatedValue: 350000,
          estimatedEquity: 100000
        },
        financials: {
          currentValue: 350000,
          afterRepairValue: 400000,
          repairCosts: 30000,
          maximumAllowableOffer: 320000
        },
        condition: 'Fair',
        owner: {
          name: 'John Smith',
          contactInfo: {
            phone: '(555) 123-4567',
            email: 'john.smith@email.com'
          },
          isAbsenteeOwner: false
        },
        taxInfo: {
          assessedValue: 320000,
          annualTaxes: 4000,
          taxDelinquent: true,
          taxDelinquentAmount: 2000
        },
        leadInfo: {
          source: 'County Records',
          dateFound: new Date(),
          assignedTo: users[0]._id,
          status: 'New',
          priority: 'High'
        },
        dataQuality: {
          completeness: 85,
          accuracy: 90
        },
        createdBy: adminUser._id
      },
      {
        address: {
          street: '456 Oak Ave',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          county: 'Miami-Dade'
        },
        propertyType: 'Single Family',
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2200,
        yearBuilt: 2005,
        foreclosureStatus: 'Auction',
        foreclosureDetails: {
          noticeOfDefaultDate: new Date('2023-12-01'),
          auctionDate: new Date('2024-02-15'),
          openingBid: 180000,
          lender: 'Wells Fargo',
          estimatedValue: 280000,
          estimatedEquity: 100000
        },
        financials: {
          currentValue: 280000,
          afterRepairValue: 320000,
          repairCosts: 25000,
          maximumAllowableOffer: 250000
        },
        condition: 'Good',
        owner: {
          name: 'Maria Garcia',
          contactInfo: {
            phone: '(305) 555-7890',
            email: 'maria.garcia@email.com'
          },
          isAbsenteeOwner: true
        },
        taxInfo: {
          assessedValue: 260000,
          annualTaxes: 3500,
          taxDelinquent: false
        },
        leadInfo: {
          source: 'Public Records',
          dateFound: new Date(),
          assignedTo: users[1]._id,
          status: 'Contacted',
          priority: 'Medium'
        },
        dataQuality: {
          completeness: 92,
          accuracy: 88
        },
        createdBy: adminUser._id
      },
      {
        address: {
          street: '789 Pine St',
          city: 'Houston',
          state: 'TX',
          zipCode: '77001',
          county: 'Harris'
        },
        propertyType: 'Townhouse',
        bedrooms: 2,
        bathrooms: 2,
        squareFeet: 1200,
        yearBuilt: 2010,
        foreclosureStatus: 'REO',
        foreclosureDetails: {
          noticeOfDefaultDate: new Date('2023-10-15'),
          auctionDate: new Date('2024-01-20'),
          openingBid: 150000,
          lender: 'Chase Bank',
          estimatedValue: 200000,
          estimatedEquity: 50000
        },
        financials: {
          currentValue: 200000,
          afterRepairValue: 230000,
          repairCosts: 15000,
          maximumAllowableOffer: 180000
        },
        condition: 'Excellent',
        owner: {
          name: 'Robert Johnson',
          contactInfo: {
            phone: '(713) 555-2468',
            email: 'robert.johnson@email.com'
          },
          isAbsenteeOwner: false
        },
        taxInfo: {
          assessedValue: 190000,
          annualTaxes: 2800,
          taxDelinquent: false
        },
        leadInfo: {
          source: 'Foreclosure Listings',
          dateFound: new Date(),
          assignedTo: users[0]._id,
          status: 'Interested',
          priority: 'High'
        },
        dataQuality: {
          completeness: 78,
          accuracy: 85
        },
        createdBy: adminUser._id
      }
    ]);
    console.log('🏠 Created sample properties');

    // Create sample leads
    const leads = await Lead.create([
      {
        property: properties[0]._id,
        source: 'Pre-Foreclosure',
        contact: {
          name: 'John Smith',
          phone: '(555) 123-4567',
          email: 'john.smith@email.com',
          preferredContact: 'Phone'
        },
        status: 'New',
        priority: 'High',
        assignedTo: users[0]._id,
        score: {
          total: 85,
          factors: {
            motivation: 20,
            timeline: 25,
            equity: 25,
            condition: 15
          }
        },
        details: {
          motivation: 'Financial Distress',
          timeline: '1-3 Months',
          askingPrice: 250000,
          condition: 'Fair'
        },
        createdBy: adminUser._id
      },
      {
        property: properties[1]._id,
        source: 'Auction',
        contact: {
          name: 'Maria Garcia',
          phone: '(305) 555-7890',
          email: 'maria.garcia@email.com',
          preferredContact: 'Email'
        },
        status: 'Contacted',
        priority: 'Medium',
        assignedTo: users[1]._id,
        score: {
          total: 72,
          factors: {
            motivation: 18,
            timeline: 20,
            equity: 20,
            condition: 14
          }
        },
        details: {
          motivation: 'Relocation',
          timeline: '3-6 Months',
          askingPrice: 180000,
          condition: 'Good'
        },
        createdBy: adminUser._id
      },
      {
        property: properties[2]._id,
        source: 'REO',
        contact: {
          name: 'Robert Johnson',
          phone: '(713) 555-2468',
          email: 'robert.johnson@email.com',
          preferredContact: 'Phone'
        },
        status: 'Interested',
        priority: 'High',
        assignedTo: users[0]._id,
        score: {
          total: 90,
          factors: {
            motivation: 22,
            timeline: 25,
            equity: 25,
            condition: 18
          }
        },
        details: {
          motivation: 'Investment',
          timeline: 'Immediate',
          askingPrice: 150000,
          condition: 'Excellent'
        },
        createdBy: adminUser._id
      }
    ]);
    console.log('📞 Created sample leads');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Sample Data Created:');
    console.log(`   👤 Users: ${await User.countDocuments()}`);
    console.log(`   🏠 Properties: ${await Property.countDocuments()}`);
    console.log(`   📞 Leads: ${await Lead.countDocuments()}`);
    
    console.log('\n🔑 Login Credentials:');
    console.log('   Admin: admin@reai.com / admin123');
    console.log('   User: john@example.com / password123');
    console.log('   Agent: jane@example.com / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed function
seedDatabase();
