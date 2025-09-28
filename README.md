# REAI - Foreclosure Investment Platform

A comprehensive platform for real estate investors to discover, analyze, and manage foreclosure investment opportunities.

## Features

### 🏠 Property Management
- **Automated Data Collection**: Scrapes foreclosure data from multiple sources including county records, public records, and listing sites
- **Property Analysis**: Advanced financial analysis tools for flip and rental investments
- **Market Intelligence**: Real-time market data and comparable sales analysis
- **Data Quality Scoring**: Automated data validation and completeness scoring

### 📊 Lead Generation & Management
- **Smart Lead Scoring**: AI-powered lead prioritization based on multiple factors
- **Communication Tracking**: Complete history of all lead interactions
- **Follow-up Automation**: Automated reminders and task management
- **CRM Integration**: Full customer relationship management capabilities

### 📈 Analytics & Reporting
- **Performance Dashboards**: Real-time analytics and KPI tracking
- **Market Trends**: Historical data analysis and trend identification
- **ROI Calculators**: Advanced financial modeling tools
- **Export Capabilities**: Data export in multiple formats

### 🔧 Automation & Workflows
- **Scheduled Data Collection**: Automated daily/weekly data scraping
- **Lead Nurturing**: Automated email and SMS campaigns
- **Task Management**: Automated follow-up reminders and task assignment
- **Integration APIs**: Connect with external tools and services

## Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Redis** for caching and session management
- **Puppeteer** for web scraping
- **Socket.io** for real-time updates
- **JWT** for authentication
- **Winston** for logging

### Frontend
- **React** with TypeScript
- **Material-UI** for component library
- **Recharts** for data visualization
- **React Router** for navigation
- **Axios** for API communication

### Data Sources
- County courthouse records
- Public records databases
- Foreclosure listing sites
- MLS data integration
- Tax records
- Market data APIs

## Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Redis (v6 or higher)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd REAI
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/foreclosure_platform
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your-super-secret-jwt-key
   PORT=5000
   
   # API Keys
   OPENAI_API_KEY=your-openai-api-key
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   ZILLOW_API_KEY=your-zillow-api-key
   
   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # SMS Configuration (Twilio)
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_PHONE_NUMBER=your-twilio-phone-number
   ```

4. **Start the services**
   ```bash
   # Start MongoDB and Redis
   # On macOS with Homebrew:
   brew services start mongodb-community
   brew services start redis
   
   # Start the application
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Usage

### Getting Started

1. **Create an Account**
   - Register for a new account at http://localhost:3000/register
   - Choose your subscription plan (Free, Basic, Professional, Enterprise)

2. **Configure Data Sources**
   - Set up your target markets and counties
   - Configure data collection preferences
   - Set up notification preferences

3. **Start Data Collection**
   - Trigger manual data collection or wait for scheduled runs
   - Monitor data quality and completeness scores
   - Review and validate collected properties

4. **Manage Leads**
   - Review generated leads and their scores
   - Assign leads to team members
   - Track communication history
   - Set up follow-up reminders

5. **Analyze Properties**
   - Use built-in analysis tools for financial modeling
   - Compare properties against market data
   - Calculate ROI and cash flow projections

### API Usage

The platform provides a RESTful API for programmatic access:

```bash
# Authentication
POST /api/auth/login
POST /api/auth/register

# Properties
GET /api/properties
POST /api/properties
GET /api/properties/:id
PUT /api/properties/:id

# Leads
GET /api/leads
POST /api/leads
GET /api/leads/:id
PUT /api/leads/:id

# Analytics
GET /api/properties/analytics
GET /api/leads/analytics
```

## Data Collection

### Automated Sources
- **County Records**: Daily scraping of foreclosure filings
- **Public Records**: Weekly updates of property ownership and liens
- **Tax Records**: Monthly updates of delinquent tax properties
- **Listing Sites**: Real-time monitoring of foreclosure listings

### Manual Sources
- **Direct Mail Campaigns**: Automated lead generation from mail campaigns
- **Referrals**: Manual entry of referral leads
- **Networking**: Import from industry contacts and events

## Security

- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: All sensitive data encrypted at rest and in transit
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation and sanitization

## Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export MONGODB_URI=mongodb://your-production-db
   export REDIS_URL=redis://your-production-redis
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Deploy with PM2**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "reai-platform"
   ```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Email: support@reai-platform.com
- Documentation: https://docs.reai-platform.com
- Issues: https://github.com/your-org/reai-platform/issues

## Roadmap

### Phase 1 (Current)
- ✅ Core platform functionality
- ✅ Basic data collection
- ✅ Lead management
- ✅ Analytics dashboard

### Phase 2 (Q2 2024)
- 🔄 Advanced financial modeling
- 🔄 Mobile application
- 🔄 Third-party integrations
- 🔄 Advanced automation

### Phase 3 (Q3 2024)
- 📋 AI-powered insights
- 📋 Predictive analytics
- 📋 Advanced reporting
- 📋 Enterprise features

## Acknowledgments

- Built with ❤️ for real estate investors
- Special thanks to the open-source community
- Inspired by the need for better foreclosure investment tools
