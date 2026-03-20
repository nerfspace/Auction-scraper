# Auction Scraper - A Complete Guide

## Overview
Auction Scraper is a web application that automatically scans eBay auctions in real-time to identify undervalued items with high resale potential. It calculates profit margins accounting for all fees and shipping costs, helping you find the best flipping opportunities.

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- An eBay Developer Account (free to create)
- A text editor or IDE

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nerfspace/auction-scraper.git
   cd auction-scraper
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Getting Your eBay API Keys

1. Go to [eBay Developer Program](https://developer.ebay.com/signin)
2. Sign in with your eBay account (or create one)
3. Navigate to "Application Keys"
4. In Sandbox environment, click "Create an app"
5. You'll receive:
   - App ID
   - Dev ID
   - Cert ID

**Note:** eBay approval takes 24-48 hours. Once approved, you can also get Production keys.

## Configuration

1. **Create a `.env` file** in the root directory:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and add your eBay credentials:**
   ```plaintext
   EBAY_APP_ID=your_app_id_here
   EBAY_DEV_ID=your_dev_id_here
   EBAY_CERT_ID=your_cert_id_here
   EBAY_AUTH_TOKEN=your_auth_token_here
   DATABASE_URL=your_database_url_here
   NODE_ENV=development
   PORT=3000
   ```

## Local Development

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Test the API:**
   - Health check: `GET http://localhost:3000/health`
   - Scan auctions: `GET http://localhost:3000/scan`
   - View opportunities: `GET http://localhost:3000/opportunities`

## How It Works

### 1. Auction Scanning (`ebayService.js`)
Searches eBay in real-time for auctions matching your keywords and pulls live bid data.

### 2. Opportunity Analysis (`valuationService.js`)
- Compares current bids to historical market values
- Calculates demand factors based on bid activity
- Detects undervalued high-value items
- Scores opportunities by ROI potential

### 3. Profit Calculation (`profitCalculator.js`)
Calculates exact profit margins including:
- eBay seller fees (12.9%)
- PayPal fees (2.2%)
- Estimated shipping costs
- ROI percentage

## Deploying to Render

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Create Render Account
- Go to [Render.com](https://render.com/)
- Sign up with GitHub

### Step 3: Create Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository (`nerfspace/auction-scraper`)
3. Select the `main` branch

### Step 4: Configure
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:** Add your eBay API keys:
  - `EBAY_APP_ID`
  - `EBAY_DEV_ID`
  - `EBAY_CERT_ID`
  - `NODE_ENV=production`

### Step 5: Deploy
Click "Create Web Service" and Render will automatically deploy!

Your app will be live at a URL like: `https://auction-scraper-xxx.onrender.com`

## Project Structure

```
auction-scraper/
├── server.js                 # Main Express server
├── package.json             # Dependencies
├── .env.example             # Environment template
├── .gitignore               # Git exclusions
├── render.yaml              # Render config
├── services/
│   ├── ebayService.js       # eBay API integration
│   └── valuationService.js  # Opportunity analysis
└── utils/
    └── profitCalculator.js  # Profit calculations
```

## API Endpoints

### Health Check
```
GET /health
Response: { "status": "UP" }
```

### Scan Auctions
```
GET /scan?keyword=vintage%20watch
Response: { "message": "Scanning auctions..." }
```

### Get Opportunities
```
GET /opportunities
Response: { "opportunities": [...] }
```

## Troubleshooting

**"eBay API Error":**
- Verify your API keys are correct
- Check that your eBay account is approved
- Ensure you're using the correct environment (Sandbox vs Production)

**"Port 3000 already in use":**
- Change PORT in .env to another number (e.g., 3001)

**"Module not found":**
- Run `npm install` again
- Delete `node_modules` folder and `package-lock.json`, then reinstall

## Next Steps

1. ✅ Create eBay Developer Account
2. ✅ Get your API keys
3. ✅ Update `.env` file
4. ✅ Test locally with `npm start`
5. ✅ Deploy to Render
6. ✅ Start finding profitable auctions!

## Support

For issues or questions about your auction scraper, check:
- eBay API Docs: https://developer.ebay.com/docs
- Render Docs: https://render.com/docs
- Node.js Docs: https://nodejs.org/docs

Happy flipping! 🚀