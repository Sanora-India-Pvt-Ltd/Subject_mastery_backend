require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));

// Auth routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/auth', require('./routes/googleAuthRoutes'));

// Basic route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 Sanora Backend API is running!',
        timestamp: new Date().toISOString(),
        endpoints: {
            student: {
                signup: 'POST /api/students/signup',
                login: 'POST /api/students/login'
            },
            doctor: {
                signup: 'POST /api/doctors/signup',
                login: 'POST /api/doctors/login'
            }
        }
    });
});

// Handle undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
    console.log(`🎯 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    console.log(`📊 Database: sanora`);
    console.log(`👨‍🎓 Student routes: http://localhost:${PORT}/api/students`);
    console.log(`👨‍⚕️ Doctor routes: http://localhost:${PORT}/api/doctors`);
});

