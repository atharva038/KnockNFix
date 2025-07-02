require("dotenv").config();
const axios = require("axios");

async function test2FactorSMS() {
  const phoneNumber = "9156906881"; // Your test number
  const otp = "123456"; // Test OTP

  console.log("🧪 Testing 2Factor.in SMS Configuration");
  console.log(
    "API Key:",
    process.env.TWOFACTOR_API_KEY ? "✅ Configured" : "❌ Missing"
  );
  console.log("Phone:", phoneNumber);
  console.log("=========================================");

  // Test 1: Basic SMS (this should send SMS, not voice)
  try {
    console.log("\n📱 Test 1: Basic SMS");
    const basicUrl = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${phoneNumber}/${otp}/KnockNFix`;
    console.log("URL:", basicUrl);

    const response1 = await axios.get(basicUrl);
    console.log("Response:", response1.data);

    if (response1.data.Status === "Success") {
      console.log("✅ Basic SMS sent successfully");
      console.log("Session ID:", response1.data.Details);
    }
  } catch (error) {
    console.log("❌ Basic SMS failed:", error.response?.data || error.message);
  }

  // Test 2: Template SMS (if template exists)
  try {
    console.log("\n📋 Test 2: Template SMS");
    const templateUrl = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${phoneNumber}/AUTOGEN/KnockNFixOTP`;
    console.log("URL:", templateUrl);

    const response2 = await axios.get(templateUrl);
    console.log("Response:", response2.data);

    if (response2.data.Status === "Success") {
      console.log("✅ Template SMS sent successfully");
      console.log("Session ID:", response2.data.Details);
    }
  } catch (error) {
    console.log(
      "❌ Template SMS failed:",
      error.response?.data || error.message
    );
  }

  // Test 3: Check account balance
  try {
    console.log("\n💰 Test 3: Account Balance");
    const balanceUrl = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/BAL/SMS`;

    const response3 = await axios.get(balanceUrl);
    console.log("Balance Response:", response3.data);
  } catch (error) {
    console.log(
      "❌ Balance check failed:",
      error.response?.data || error.message
    );
  }
}

test2FactorSMS();
