const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/verify.html?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@casino.com',
    to: email,
    subject: 'Verify Your Casino Platform Account',
    html: `
      Welcome to Casino Platform!
      Please click the link below to verify your email address:
      ${verificationUrl}
      This link will expire in 24 hours.
      If you didn't create an account, please ignore this email.
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent to:', email);
  } catch (error) {
    console.error('Email error:', error);
    // Don't throw error - allow registration to continue
  }
}

module.exports = { sendVerificationEmail };
