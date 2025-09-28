const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Please copy env.example to .env and configure it.');
  process.exit(1);
}

// Start the data collection scheduler
const DataCollectionScheduler = require('../server/services/automation/dataCollectionScheduler');

async function startScheduler() {
  try {
    const scheduler = new DataCollectionScheduler();
    await scheduler.initialize();
    scheduler.startScheduledJobs();
    console.log('✅ Data collection scheduler started');
  } catch (error) {
    console.error('❌ Failed to start data collection scheduler:', error);
  }
}

// Start the scheduler
startScheduler();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});
