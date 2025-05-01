const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet'); // You'll need to install this package
const rateLimit = require('express-rate-limit'); // You'll need to install this package
const db = require('./models');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Log API requests in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// API Routes
app.use('/api/auth', require('./routes/authentication'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/games', require('./routes/games'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/reviews', require('./routes/reviews'));

// Root route
app.get('/', (req, res) => {
  res.send('Game Analytics Platform API is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    error: statusCode === 500 ? 'Server error' : err.message,
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Function to check database connection
async function checkDbConnection() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
}

// Sync Sequelize models and start server
async function startServer() {
  // Check database connection first
  const dbConnected = await checkDbConnection();
  
  if (!dbConnected) {
    console.error('Failed to connect to database, server will not start');
    process.exit(1);
  }
  
  try {
    // Sync database with models
    await db.sequelize.sync({ 
      alter: process.env.NODE_ENV === 'development' 
    });
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Unable to sync database or start server:', err);
    process.exit(1);
  }
}

// Start the application
startServer();