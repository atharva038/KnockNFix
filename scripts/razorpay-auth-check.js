require('dotenv').config();
const Razorpay = require('razorpay');

async function main() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  const summary = {
    keyIdPresent: Boolean(keyId),
    keySecretPresent: Boolean(keySecret),
    keyIdPrefix: keyId.slice(0, 10),
    keyMode: keyId.startsWith('rzp_test_')
      ? 'test'
      : keyId.startsWith('rzp_live_')
      ? 'live'
      : 'unknown',
    keyIdLength: keyId.length,
    keySecretLength: keySecret.length,
    keyIdHasWhitespace: /\s/.test(keyId),
    keySecretHasWhitespace: /\s/.test(keySecret),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!keyId || !keySecret) {
    console.log('RAZORPAY_AUTH_CHECK=FAIL');
    console.log(JSON.stringify({
      statusCode: 0,
      description: 'Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET',
    }, null, 2));
    process.exit(1);
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  try {
    await razorpay.orders.all({ count: 1 });
    console.log('RAZORPAY_AUTH_CHECK=PASS');
    process.exit(0);
  } catch (error) {
    console.log('RAZORPAY_AUTH_CHECK=FAIL');
    console.log(
      JSON.stringify(
        {
          statusCode: error?.statusCode || 0,
          description: error?.error?.description || error?.message || 'Unknown error',
          code: error?.error?.code || null,
        },
        null,
        2
      )
    );
    process.exit(1);
  }
}

main();
