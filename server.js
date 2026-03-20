const express = require('express');
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Scan endpoint
app.get('/scan', (req, res) => {
    // Logic for scanning
    res.status(200).send('Scanning...');
});

// Opportunities endpoint
app.get('/opportunities', (req, res) => {
    // Logic for getting opportunities
    res.status(200).send('Opportunities data');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});