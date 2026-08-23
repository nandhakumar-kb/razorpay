import { createPaymentLink } from '../src/lib/services/razorpay';
import { config } from 'dotenv';
config();

async function testApi() {
  try {
    const link = await createPaymentLink(
      15000, 
      'Acme Corp',
      'acme@example.com',
      'Recovery for failed payment',
      'ref_123456789012345678901234567890'
    );
    console.log("Success! Link ID:", (link as any).id || "Mocked Link");
  } catch (error: any) {
    console.error('Error stringified:', JSON.stringify(error, null, 2));
  }
}

testApi();
