const functions = require("firebase-functions");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail", // Gunakan layanan email seperti Gmail
  auth: {
    user: "your-email@gmail.com", // Ganti dengan email pengirim
    pass: "your-email-password", // Ganti dengan password email pengirim
  },
});

// Fungsi untuk mengirim OTP
exports.sendOtpEmail = functions.firestore
    .document("otp/{email}")
    .onCreate(async (snap, context) => {
      const email = context.params.email;
      const otpData = snap.data();

      const mailOptions = {
        from: "your-email@gmail.com",
        to: email,
        subject: "Kode OTP Anda",
        text: `Kode OTP Anda adalah: ${otpData.otp}. Jangan bagikan kode ini kepada siapapun.`,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("OTP terkirim ke:", email);
      } catch (error) {
        console.error("Gagal mengirim email:", error);
      }
    });
