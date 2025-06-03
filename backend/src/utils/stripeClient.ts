import Stripe from 'stripe';

// Stripe クライアントの初期化
const stripeSecretKey = process.env['STRIPE_SECRET_KEY'];

let stripe: Stripe | null = null;

if (!stripeSecretKey || stripeSecretKey.startsWith('sk_test_your_')) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not configured or using dummy values. Stripe features will be disabled.');
} else {
  try {
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
    console.log('✅ Stripe client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Stripe client:', error);
  }
}

export { stripe };

export default stripe; 