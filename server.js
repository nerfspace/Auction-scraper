const express = require('express');
const app = express();

app.all("/notification", (req, res) => {
  console.log("📬 eBay Notification (alternate) received");
  const challengeCode = req.query.challenge_code || req.body?.challengeCode;
  
  if (challengeCode) {
    res.type('text/plain').status(200).send(challengeCode);
  } else {
    res.status(200).json({ statusCode: 200, verificationToken: "auction-scraper-ebay-compliance-verification-token-2026" });
  }
});

// Existing code in server.js...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});