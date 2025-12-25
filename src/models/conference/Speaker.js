const mongoose = require('mongoose');
const ConferenceAccount = require('./ConferenceAccount');

// Speaker discriminator on shared ConferenceAccount collection
const speakerSchema = new mongoose.Schema({}, { _id: false });

module.exports = ConferenceAccount.discriminator('SPEAKER', speakerSchema);

