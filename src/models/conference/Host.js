const mongoose = require('mongoose');
const ConferenceAccount = require('./ConferenceAccount');

// Host discriminator on shared ConferenceAccount collection
const hostSchema = new mongoose.Schema({}, { _id: false });

module.exports = ConferenceAccount.discriminator('HOST', hostSchema);

