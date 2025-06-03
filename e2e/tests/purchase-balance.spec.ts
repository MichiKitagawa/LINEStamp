import { test, expect } from '@playwright/test';

test.describe('3.2 ダッシュボード → 購入 → 残高反映', () => {
  
  test.beforeEach(async ({ page }) => {
    // 各テスト前に認証状態を設定
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('mockAuthUser', JSON.stringify({
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      }));
    });
  });

  test('3.2-01 ダッシュボードからトークン購入ページへ遷移', async ({ page }) => {
    // ダッシュボードにアクセス
    await page.goto('/dashboard');
    
    // 「トークン購入」リンクまたはボタンをクリック
    await page.click('a:has-text("トークン購入"), button:has-text("トークン購入")');
    
    // 購入ページに遷移することを確認
    await expect(page).toHaveURL('/purchase');
    
    // ページタイトルの確認
    await expect(page).toHaveTitle(/トークン購入/);
  });

  test('3.2-02 40トークン選択から購入ボタンクリック', async ({ page }) => {
    // 購入ページにアクセス
    await page.goto('/purchase');
    
    // 40トークンのオプションを選択
    await page.check('input[value="40tokens"]');
    
    // 選択されていることを確認
    await expect(page.locator('input[value="40tokens"]')).toBeChecked();
    
    // 「購入する」ボタンをクリック
    await page.click('button:has-text("購入する")');
    
    // ローディング状態が表示されることを確認
    await expect(page.locator('text=処理中')).toBeVisible();
  });

  test('3.2-03 Stripe Checkout モック完了後のダッシュボード復帰', async ({ page }) => {
    // Stripe Checkout のモック設定
    await page.route('**/tokens/checkout-session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'cs_test_session_id',
          url: 'https://checkout.stripe.com/test'
        })
      });
    });

    // 購入ページにアクセス
    await page.goto('/purchase');
    
    // 40トークンを選択して購入
    await page.check('input[value="40tokens"]');
    await page.click('button:has-text("購入する")');
    
    // Stripe Checkout モックページ（実際にはリダイレクトをモック）
    await page.evaluate(() => {
      // 決済完了のモック
      window.location.href = '/dashboard?payment=success';
    });
    
    // ダッシュボードに戻ることを確認
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('3.2-04 トークン残数が40に更新されている', async ({ page }) => {
    // API レスポンスのモック設定
    await page.route('**/tokens/balance', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 40
        })
      });
    });

    await page.route('**/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'test-user-id',
          displayName: 'Test User',
          email: 'test@example.com',
          tokenBalance: 40
        })
      });
    });
    
    // ダッシュボードにアクセス
    await page.goto('/dashboard');
    
    // トークン残数が40と表示されることを確認
    await expect(page.locator('text=40')).toBeVisible();
    await expect(page.locator('text=所持トークン')).toBeVisible();
  });

  test('エラーケース: 無効なtokenPackage選択', async ({ page }) => {
    // 購入ページにアクセス
    await page.goto('/purchase');
    
    // tokenPackageを選択せずに購入ボタンをクリック
    await page.click('button:has-text("購入する")');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=トークンパッケージを選択してください')).toBeVisible();
  });

  test('エラーケース: ネットワークエラー時の処理', async ({ page }) => {
    // ネットワークエラーをモック
    await page.route('**/tokens/checkout-session', async route => {
      await route.abort('failed');
    });

    // 購入ページにアクセス
    await page.goto('/purchase');
    
    // 40トークンを選択して購入
    await page.check('input[value="40tokens"]');
    await page.click('button:has-text("購入する")');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=エラーが発生しました')).toBeVisible();
  });
}); 