const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sanora';

async function migrateBlockedUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find all users with blockedUsers
    const users = await User.find({
      $or: [
        { blockedUsers: { $exists: true, $not: { $size: 0 } } },
        { 'social.blockedUsers': { $exists: true, $not: { $size: 0 } } }
      ]
    });

    console.log(`Found ${users.length} users with blocked users to process`);

    let migratedCount = 0;
    
    for (const user of users) {
      // Skip if no blockedUsers at root level
      if (!user.blockedUsers || user.blockedUsers.length === 0) {
        continue;
      }

      // Initialize social.blockedUsers if it doesn't exist
      if (!user.social) {
        user.social = { blockedUsers: [] };
      } else if (!user.social.blockedUsers) {
        user.social.blockedUsers = [];
      }

      // Add any blocked users from root that don't already exist in social.blockedUsers
      const existingBlocked = new Set(
        user.social.blockedUsers.map(id => id.toString())
      );
      
      const newBlockedUsers = user.blockedUsers.filter(
        id => !existingBlocked.has(id.toString())
      );

      if (newBlockedUsers.length > 0) {
        user.social.blockedUsers.push(...newBlockedUsers);
        await user.save();
        migratedCount++;
        console.log(`Migrated ${newBlockedUsers.length} blocked users for user ${user._id}`);
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`- Processed ${users.length} users`);
    console.log(`- Migrated blocked users for ${migratedCount} users`);
    
    // Optional: Remove the root blockedUsers field after verification
    // Uncomment and run separately after verifying the migration
    // await User.updateMany(
    //   { blockedUsers: { $exists: true } },
    //   { $unset: { blockedUsers: "" } }
    // );
    // console.log('Removed root blockedUsers field from all users');

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrateBlockedUsers();
