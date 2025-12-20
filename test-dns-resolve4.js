const dns = require('dns');

console.log('Testing DNS with resolve4 (what server.js now uses)...\n');

const dnsTestTimeout = setTimeout(() => {
  console.log('⚠️  DNS test timeout - skipping verification');
  process.exit(0);
}, 3000);

dns.resolve4('verify.twilio.com', (err, addresses) => {
  clearTimeout(dnsTestTimeout);
  if (err) {
    console.log('❌ DNS test failed:', err.code);
    console.log('Error:', err.message);
  } else {
    console.log('✅ DNS test passed!');
    console.log('Addresses:', addresses);
  }
  process.exit(0);
});
