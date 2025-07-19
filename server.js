const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(bodyParser.json()); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files (HTML, CSS, JS, images) from the root directory
app.use(express.static(path.join(__dirname)));

// API endpoint for the contact form
app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All required fields must be filled out.' });
  }

  // In a real application, you would process this data (e.g., send an email, save to a database)
  console.log('Received contact form submission:', req.body);

  // Send a success response back to the client
  res.status(200).json({ message: 'Thank you for your message! We will get back to you soon.' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});