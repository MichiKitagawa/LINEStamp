import { Router, Request, Response } from 'express';
import { verifyIdToken } from '@/middleware/verifyIdToken';
import { firestore } from '@/utils/firebaseAdmin';
import { stripe } from '@/utils/stripeClient';
import {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  TokenBalance,
  TOKEN_PACKAGES,
  TokenTransaction,
} from '@/types/tokens';

const router = Router();

/**
 * POST /tokens/checkout-session
 * Stripe Checkout セッションを作成
 */
router.post('/checkout-session', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { tokenPackage } = req.body as CheckoutSessionRequest;
    const uid = req.uid!;

    // パッケージの存在確認
    const packageInfo = TOKEN_PACKAGES[tokenPackage];
    if (!packageInfo) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid token package',
      });
      return;
    }

    // Stripe Checkout セッションを作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: packageInfo.name,
              description: packageInfo.description,
            },
            unit_amount: packageInfo.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/dashboard?payment=success`,
      cancel_url: `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/purchase?payment=cancel`,
      metadata: {
        userId: uid,
        tokenPackage: tokenPackage,
      },
    });

    const response: CheckoutSessionResponse = {
      sessionId: session.id,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Checkout session creation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create checkout session',
    });
  }
});

/**
 * GET /tokens/balance
 * ユーザーのトークン残数を取得
 */
router.get('/balance', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const uid = req.uid!;

    // Firestore からユーザー情報を取得
    const userDoc = await firestore.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
      return;
    }

    const userData = userDoc.data();
    const balance: TokenBalance = {
      balance: userData?.['tokenBalance'] || 0,
    };

    res.status(200).json(balance);
  } catch (error) {
    console.error('Token balance retrieval error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve token balance',
    });
  }
});

/**
 * POST /webhook/stripe
 * Stripe Webhook を受信してトークンを付与
 */
router.post('/webhook/stripe', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not set');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Webhook secret not configured',
      });
      return;
    }

    let event;
    try {
      // Webhook の署名を検証
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid webhook signature',
      });
      return;
    }

    // checkout.session.completed イベントを処理
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const { userId, tokenPackage } = session.metadata;

      if (!userId || !tokenPackage) {
        console.error('Missing metadata in webhook:', session.metadata);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid metadata',
        });
        return;
      }

      // パッケージ情報を取得
      const packageInfo = TOKEN_PACKAGES[tokenPackage];
      if (!packageInfo) {
        console.error('Invalid token package:', tokenPackage);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid token package',
        });
        return;
      }

      // Firestore トランザクションでトークンを付与
      await firestore.runTransaction(async (transaction) => {
        const userRef = firestore.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        const userData = userDoc.data()!;
        const newBalance = (userData['tokenBalance'] || 0) + packageInfo.tokens;

        // ユーザーのトークン残数を更新
        transaction.update(userRef, {
          tokenBalance: newBalance,
          updatedAt: new Date().toISOString(),
        });

        // トランザクション履歴を保存
        const transactionData: Omit<TokenTransaction, 'id'> = {
          userId,
          type: 'purchase',
          amount: packageInfo.tokens,
          packageId: packageInfo.id,
          stripeSessionId: session.id,
          createdAt: new Date().toISOString(),
        };

        const transactionRef = firestore.collection('token_transactions').doc();
        transaction.set(transactionRef, transactionData);
      });

      console.log(`Tokens added successfully: ${userId} +${packageInfo.tokens}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process webhook',
    });
  }
});

export default router; 