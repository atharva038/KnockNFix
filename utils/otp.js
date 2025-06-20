const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Fix: Use createTransport instead of createTransporter
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Initialize Twilio client for SMS with better error checking
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('Twilio client initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Twilio client:', error.message);
    }
} else {
    console.warn('Twilio credentials not found in environment variables');
}

// Generate a random OTP
const generateOTP = (length = 6) => {
    // Generate a random number with specified length
    return Math.floor(100000 + Math.random() * 900000).toString().substring(0, length);
};

// Send OTP via email
const sendEmailOTP = async (email, otp) => {
    try {
        // Check if email transporter is configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            throw new Error('Email credentials not configured');
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'KnockNFix - Email Verification OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #3182ce;">KnockNFix Email Verification</h2>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p>Hello,</p>
                        <p>Your email verification code is:</p>
                        <h3 style="text-align: center; font-size: 24px; letter-spacing: 5px; color: #3182ce; background: #f0f0f0; padding: 10px; border-radius: 5px;">${otp}</h3>
                        <p>This code will expire in 10 minutes.</p>
                    </div>
                    <div style="color: #666; font-size: 13px;">
                        <p>If you didn't request this code, please ignore this email.</p>
                        <p>Thank you,<br>KnockNFix Team</p>
                    </div>
                </div>
            `
        };

        await emailTransporter.sendMail(mailOptions);
        console.log(`Email OTP sent successfully to ${email}`);
        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

// Update the sendSmsOTP function
const sendSmsOTP = async (phoneNumber, otp) => {
    try {
        // For development without Twilio, just return success with console log
        if (!twilioClient) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`📱 [DEV MODE] SMS OTP for ${phoneNumber}: ${otp}`);
                console.log('💡 Use this OTP for testing since Twilio is not configured');
                return { success: true, dev_mode: true };
            }
            throw new Error('Twilio client not initialized - check your credentials');
        }

        if (!process.env.TWILIO_PHONE_NUMBER) {
            throw new Error('Twilio phone number not configured');
        }

        // Validate phone number format
        if (!phoneNumber || phoneNumber.length < 10) {
            throw new Error('Invalid phone number provided');
        }

        // Format the phone number for India
        let formattedPhone = phoneNumber;
        if (!phoneNumber.startsWith('+')) {
            // Remove any leading zeros and format with India country code
            const cleanPhone = phoneNumber.replace(/^0+/, '');
            formattedPhone = `+91${cleanPhone}`;
        }

        console.log(`📱 Attempting to send SMS to: ${formattedPhone}`);

        const message = await twilioClient.messages.create({
            body: `Your KnockNFix verification code is: ${otp}. This code expires in 10 minutes. Do not share this code with anyone.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedPhone
        });

        console.log(`✅ SMS sent successfully. Message SID: ${message.sid}`);
        return { success: true, messageSid: message.sid };

    } catch (error) {
        console.error('❌ SMS sending error:', error);

        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.code === 20003) {
            errorMessage = 'Twilio authentication failed - check your Account SID and Auth Token';
        } else if (error.code === 21608) {
            errorMessage = 'Invalid Twilio phone number - check your FROM number configuration';
        } else if (error.code === 21211) {
            errorMessage = 'Invalid phone number format';
        } else if (error.code === 21614) {
            errorMessage = 'Phone number is not verified in trial account';
        }

        return { success: false, error: errorMessage };
    }
};

// Test Twilio configuration
const testTwilioConfig = () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🚧 Running in development mode - SMS will work without Twilio');
    }

    if (!process.env.TWILIO_ACCOUNT_SID) {
        console.error('❌ TWILIO_ACCOUNT_SID is missing');
        return false;
    }
    if (!process.env.TWILIO_AUTH_TOKEN) {
        console.error('❌ TWILIO_AUTH_TOKEN is missing');
        return false;
    }
    if (!process.env.TWILIO_PHONE_NUMBER) {
        console.error('❌ TWILIO_PHONE_NUMBER is missing');
        return false;
    }

    console.log('✅ Twilio configuration appears complete');
    console.log(`Account SID: ${process.env.TWILIO_ACCOUNT_SID.substring(0, 8)}...`);
    console.log(`Phone Number: ${process.env.TWILIO_PHONE_NUMBER}`);
    return true;
};

// Test email configuration
const testEmailConfig = () => {
    if (!process.env.EMAIL_USER) {
        console.warn('⚠️ EMAIL_USER is missing - email OTP will not work');
        return false;
    }
    if (!process.env.EMAIL_PASSWORD) {
        console.warn('⚠️ EMAIL_PASSWORD is missing - email OTP will not work');
        return false;
    }

    console.log('✅ Email configuration appears complete');
    console.log(`Email User: ${process.env.EMAIL_USER}`);
    return true;
};

// Run configuration tests on module load
console.log('\n=== OTP Service Configuration Check ===');
testEmailConfig();
testTwilioConfig();
console.log('=========================================\n');

module.exports = {
    generateOTP,
    sendEmailOTP,
    sendSmsOTP,
    testTwilioConfig,
    testEmailConfig
};