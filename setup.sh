#!/bin/bash

echo "🚀 Setting up REAI Foreclosure Investment Platform..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB is not installed. Please install MongoDB 4.4 or higher."
    echo "   On macOS: brew install mongodb-community"
    echo "   On Ubuntu: sudo apt-get install mongodb"
fi

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "⚠️  Redis is not installed. Please install Redis 6 or higher."
    echo "   On macOS: brew install redis"
    echo "   On Ubuntu: sudo apt-get install redis-server"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created. Please update it with your configuration."
else
    echo "✅ .env file already exists."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Start MongoDB and Redis services
echo "🔧 Starting services..."
if command -v brew &> /dev/null; then
    # macOS with Homebrew
    brew services start mongodb-community 2>/dev/null || echo "MongoDB service not found or already running"
    brew services start redis 2>/dev/null || echo "Redis service not found or already running"
elif command -v systemctl &> /dev/null; then
    # Linux with systemd
    sudo systemctl start mongod 2>/dev/null || echo "MongoDB service not found or already running"
    sudo systemctl start redis 2>/dev/null || echo "Redis service not found or already running"
fi

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Seed the database
echo "🌱 Seeding database with sample data..."
npm run seed

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update your .env file with API keys and configuration"
echo "   2. Start the development server: npm run dev"
echo "   3. Open http://localhost:3000 in your browser"
echo ""
echo "🔑 Default login credentials:"
echo "   Admin: admin@reai.com / admin123"
echo "   User: john@example.com / password123"
echo "   Agent: jane@example.com / password123"
echo ""
echo "📚 For more information, see the README.md file"
