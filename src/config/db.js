const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Check if MONGODB_URI is defined
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI is not defined in environment variables');
            console.error('💡 Make sure you have a .env file with MONGODB_URI set');
            process.exit(1);
        }

        // Log connection attempt (without showing password)
        const uriWithoutPassword = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@');
        console.log(`🔄 Attempting to connect to MongoDB...`);
        console.log(`📍 Connection string: ${uriWithoutPassword}`);

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        });
        
        console.log(`✅ MongoDB Connected to database: ${conn.connection.name}`);
        console.log(`📍 Host: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ MongoDB connection failed!');
        console.error('Error details:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('authentication failed')) {
            console.error('💡 Authentication failed - Check your username and password');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            console.error('💡 DNS/Network error - Check your cluster URL');
        } else if (error.message.includes('timeout')) {
            console.error('💡 Connection timeout - Check your network and MongoDB Atlas IP whitelist');
        } else if (error.message.includes('bad auth')) {
            console.error('💡 Bad authentication - Verify username and password are correct');
        }
        
        console.error('\n📋 Troubleshooting steps:');
        console.error('1. Verify MONGODB_URI in your .env file');
        console.error('2. Check MongoDB Atlas Network Access (IP whitelist)');
        console.error('3. Verify username and password are correct');
        console.error('4. Ensure MongoDB Atlas cluster is running');
        console.error('5. Check if password has special characters that need URL encoding');
        
        process.exit(1);
    }
};

module.exports = connectDB;