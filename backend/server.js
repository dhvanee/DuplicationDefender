require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

// Debug environment variables
console.log(process.env.MONGO_URI); // Should print the MongoDB URI

console.log('Environment variables loaded:', {
  MONGO_URI: process.env.MONGO_URI ? 'Present' : 'Missing',
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV
});

// Import routes
const authRoutes = require('./src/routes/auth');
const recordRoutes = require('./src/routes/records');
const userRoutes = require('./src/routes/user');
const duplicateRoutes = require('./src/routes/duplicates');
const fileRoutes = require('./src/routes/fileRoutes');

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8081', 
          'http://127.0.0.1:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:8081'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Health check route
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.json({ 
    status: isDbConnected ? 'ok' : 'error',
    message: isDbConnected ? 'Server is running' : 'Database connection error',
    dbStatus: isDbConnected ? 'connected' : 'disconnected',
    dbName: mongoose.connection.db?.databaseName || 'not connected'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/user', userRoutes);
app.use('/api/duplicates', duplicateRoutes);
app.use('/api/files', fileRoutes);

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Connect to MongoDB with error handling
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received');
      server.close(() => {
        console.log('Server closed');
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

startServer();