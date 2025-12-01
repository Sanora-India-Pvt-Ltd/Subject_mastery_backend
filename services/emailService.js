const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const sendOTPEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: `"Sanora" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your OTP Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Sanora OTP Verification</h2>
                    <p>Your One-Time Password (OTP) is:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="margin: 0; color: #333; letter-spacing: 5px;">${otp}</h1>
                    </div>
                    <p>This OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.</p>
                    <p style="color: #666; font-size: 12px;">If you didn't request this OTP, please ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 OTP email sent to ${email}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = { sendOTPEmail };