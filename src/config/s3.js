const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION
  // credentials auto-picked from env (local) or IAM role (EC2)
});

module.exports = s3;
