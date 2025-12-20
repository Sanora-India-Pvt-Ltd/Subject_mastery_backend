const dns = require('dns');

console.log('Testing DNS from your project directory...\n');

// Test 1: dns.lookup with {all: true}
console.log('Test 1: dns.lookup with {all: true}');
dns.lookup('verify.twilio.com', {all: true}, (err, addresses) => {
  if (err) {
    console.log('❌ Error:', err.code, '-', err.message);
  } else {
    console.log('✅ Success:', addresses);
  }
  
  // Test 2: dns.resolve4
  console.log('\nTest 2: dns.resolve4');
  dns.resolve4('verify.twilio.com', (err, addresses) => {
    if (err) {
      console.log('❌ Error:', err.code, '-', err.message);
    } else {
      console.log('✅ Success:', addresses);
    }
    
    // Test 3: Load Twilio
    console.log('\nTest 3: Loading Twilio module');
    try {
      const twilio = require('twilio');
      console.log('✅ Twilio loaded successfully');
      console.log('Twilio version:', require('twilio/package.json').version);
    } catch (err) {
      console.log('❌ Error loading Twilio:', err.message);
    }
  });
});
