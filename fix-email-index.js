/**
 * Script to fix duplicate email index issue
 * 
 * This script removes the old flat "email" index that conflicts with the new nested "profile.email" structure
 * 
 * Run this script once to fix the database:
 * node fix-email-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixEmailIndex() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('❌ MONGODB_URI not found in environment variables');
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        // List all indexes
        const indexes = await collection.indexes();
        console.log('\n📋 Current indexes:');
        indexes.forEach(index => {
            console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        // Check for users with null email (from old schema) that might cause issues
        const usersWithNullEmail = await collection.find({ email: null }).toArray();
        if (usersWithNullEmail.length > 0) {
            console.log(`\n⚠️  Found ${usersWithNullEmail.length} user(s) with null email (old schema)`);
            console.log('   These users may need migration or cleanup.');
            
            // Check if these users have profile.email set
            for (const user of usersWithNullEmail) {
                if (user.profile && user.profile.email) {
                    console.log(`   - User ${user._id}: has profile.email (${user.profile.email}), removing null email field`);
                    await collection.updateOne(
                        { _id: user._id },
                        { $unset: { email: "" } }
                    );
                } else {
                    console.log(`   - User ${user._id}: no profile.email found - may need manual review`);
                }
            }
        }

        // Check for old email index
        const emailIndex = indexes.find(idx => idx.name === 'email_1' || (idx.key && idx.key.email));
        
        if (emailIndex) {
            console.log(`\n🔧 Found old email index: ${emailIndex.name}`);
            console.log('   Dropping old email index...');
            
            try {
                await collection.dropIndex(emailIndex.name);
                console.log(`✅ Successfully dropped index: ${emailIndex.name}`);
            } catch (error) {
                if (error.code === 27) {
                    console.log(`⚠️  Index ${emailIndex.name} doesn't exist (may have been already dropped)`);
                } else if (error.code === 85 || error.message.includes('duplicate')) {
                    // Index has duplicate null values - need to clean up first
                    console.log(`⚠️  Cannot drop index due to duplicate null values. Cleaning up...`);
                    // Remove email field from all documents that have null email
                    await collection.updateMany(
                        { email: null },
                        { $unset: { email: "" } }
                    );
                    // Try dropping again
                    await collection.dropIndex(emailIndex.name);
                    console.log(`✅ Successfully dropped index: ${emailIndex.name} after cleanup`);
                } else {
                    throw error;
                }
            }
        } else {
            console.log('\n✅ No old email index found. Database is up to date.');
        }

        // Verify profile.email index exists
        const profileEmailIndex = indexes.find(idx => 
            idx.name === 'profile.email_1' || 
            (idx.key && idx.key['profile.email'])
        );

        if (!profileEmailIndex) {
            console.log('\n📝 Creating index on profile.email...');
            await collection.createIndex({ 'profile.email': 1 }, { unique: true, name: 'profile.email_1' });
            console.log('✅ Created index on profile.email');
        } else {
            console.log('\n✅ Index on profile.email already exists');
        }

        // List indexes after fix
        const finalIndexes = await collection.indexes();
        console.log('\n📋 Final indexes:');
        finalIndexes.forEach(index => {
            console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        console.log('\n✅ Database index fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Error fixing email index:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the fix
fixEmailIndex();

