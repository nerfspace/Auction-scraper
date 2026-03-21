const express = require('express');
const app = express();

const crypto = require('crypto');

app.all("/notification", (req, res) => {
  console.log("📬 eBay Notification received");
  
  const challengeCode = req.query.challenge_code;
  const endpoint = 'https://auction-scraper-tey5.onrender.com/notification';
  const verificationToken = 'auction-scraper-ebay-compliance-verification-token-2026';
  
  if (challengeCode) {
    console.log("✅ Challenge code received:", challengeCode);
    
    // Hash: challengeCode + verificationToken + endpoint (in order)
    const hash = crypto.createHash('sha256');
    hash.update(challengeCode);
    hash.update(verificationToken);
    hash.update(endpoint);
    const responseHash = hash.digest('hex');
    
    console.log("✅ Sending challenge response:", responseHash);
    res.set('Content-Type', 'application/json');
    res.status(200).json({
      challengeResponse: responseHash
    });
  } else {
    // Normal notification acknowledgment
    res.status(200).json({ statusCode: 200 });
  }
});

// Existing code in server.js...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
