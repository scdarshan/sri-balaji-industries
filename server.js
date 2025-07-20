require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
// The port will be set by the hosting provider (e.g., Render) via an environment variable.
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(bodyParser.json()); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files (HTML, CSS, JS, images) from the root directory
app.use(express.static(path.join(__dirname)));

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  debug: true, // show SMTP traffic in the console
  logger: true // log information in console
});

// API endpoint for the contact form
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, company, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All required fields must be filled out.' });
  }
  
  console.log('Received contact form submission:', req.body);

  const mailOptions = {
    from: `"Website Contact Form" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO, // The email address where you want to receive notifications
    subject: `New Contact Form Submission: ${subject}`,
    html: `
      <h2>New Message from Sri Balaji Industries Website</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Company:</strong> ${company || 'Not provided'}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr>
      <h3>Message:</h3>
      <p>${message}</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Notification email sent successfully.');
    console.log('Message sent: %s', info.messageId);
    console.log('SMTP Response: %s', info.response);
    // Send a success response back to the client
    res.status(200).json({ message: 'Thank you for your message! We will get back to you soon.' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Sorry, there was an error sending your message. Please try again later.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});