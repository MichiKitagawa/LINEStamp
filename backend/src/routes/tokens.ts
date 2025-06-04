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
import { ConsumeTokensRequest, ConsumeTokensResponse } from '@/types/stamps';

const router = Router();

/**
 * POST /tokens/checkout-session
 * Stripe Checkout セッションを作成
 */
router.post('/checkout-session', verifyIdToken, async (req: Request, res: Response) => {
  try {
    // Stripe機能が無効な場合のチェック
    if (!stripe) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Payment service is not configured',
      });
      return;
    }

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
          // Price IDが設定されている場合はそれを使用、設定されていない場合はprice_dataを使用
          ...(packageInfo.stripePriceId 
            ? { price: packageInfo.stripePriceId, quantity: 1 }
            : {
                price_data: {
                  currency: 'jpy',
                  product_data: {
                    name: packageInfo.name,
                    description: packageInfo.description,
                  },
                  unit_amount: packageInfo.price,
                },
                quantity: 1,
              }
          ),
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
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

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
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

    // Stripe機能が無効な場合のチェック
    if (!stripe) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Payment service is not configured',
      });
      return;
    }

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

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
      await firestore!.runTransaction(async (transaction: any) => {
        const userRef = firestore!.collection('users').doc(userId);
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

        const transactionRef = firestore!.collection('token_transactions').doc();
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

/**
 * POST /tokens/consume
 * トークンを消費
 */
router.post('/consume', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

    const uid = req.uid!;
    const { stampId, amount } = req.body as ConsumeTokensRequest;

    if (!stampId || !amount || amount <= 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'stampId and positive amount are required',
      });
      return;
    }

    console.log(`Consuming ${amount} tokens for user ${uid} and stamp ${stampId}`);

    let remainingBalance = 0;

    await firestore.runTransaction(async (transaction: any) => {
      // ユーザーの現在のトークン残数を取得
      const userRef = firestore!.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data()!;
      const currentBalance = userData['tokenBalance'] || 0;

      if (currentBalance < amount) {
        throw new Error('Insufficient tokens');
      }

      // トークンを消費
      remainingBalance = currentBalance - amount;
      transaction.update(userRef, {
        tokenBalance: remainingBalance,
        updatedAt: new Date().toISOString(),
      });

      // 消費履歴を保存
      const transactionData: Omit<TokenTransaction, 'id'> = {
        userId: uid,
        type: 'consume',
        amount: -amount, // 消費は負の値で記録
        stampId,
        createdAt: new Date().toISOString(),
      };

      const transactionRef = firestore!.collection('token_transactions').doc();
      transaction.set(transactionRef, transactionData);
    });

    console.log(`Tokens consumed successfully: ${uid} -${amount}, remaining: ${remainingBalance}`);

    const response: ConsumeTokensResponse = {
      success: true,
      remainingBalance,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Token consumption error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }
      if (error.message === 'Insufficient tokens') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Insufficient token balance',
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to consume tokens',
    });
  }
});

export default router; 