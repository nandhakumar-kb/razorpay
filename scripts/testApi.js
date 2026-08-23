const Razorpay = require('razorpay');

const keyId = 'rzp_test_TSp0ZrRMrqnd7v';
const keySecret = '74ePxpYzITOcOEoPdnU1IkRh';

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

async function testApi() {
  try {
    const paymentLink = await razorpay.paymentLink.create({
      amount: 15000,
      currency: 'INR',
      accept_partial: false,
      description: 'Recovery for failed payment',
      customer: {
        name: 'Acme Corp',
        contact: '9876543210',
        email: 'acme@example.com',
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      reference_id: 'ref_123456789012345678901234567890'
    });
    console.log('Success:', paymentLink.id);
  } catch (error) {
    console.error('Error stringified:', JSON.stringify(error, null, 2));
  }
}

testApi();
