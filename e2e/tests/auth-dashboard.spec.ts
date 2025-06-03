import { test, expect } from '@playwright/test';

test.describe('3.1 認証 → ダッシュボード', () => {
  
  test('3.1-01 ログインページに「Googleでログイン」ボタンが表示される', async ({ page }) => {
    // ログインページにアクセス
    await page.goto('/login');
    
    // 「Googleでログイン」ボタンが表示されることを確認
    const loginButton = page.locator('button:has-text("Googleでログイン")');
    await expect(loginButton).toBeVisible();
    
    // ページタイトルの確認
    await expect(page).toHaveTitle(/ログイン/);
  });

  test('3.1-02 Google ログインモックからダッシュボードに遷移', async ({ page }) => {
    // ローカルストレージに認証状態をモック設定
    await page.goto('/login');
    
    // Firebase認証のモック設定
    await page.evaluate(() => {
      // モックユーザーデータをlocalStorageに設定
      localStorage.setItem('mockAuthUser', JSON.stringify({
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      }));
    });

    // 「Googleでログイン」ボタンをクリック
    await page.click('button:has-text("Googleでログイン")');
    
    // ダッシュボードページに遷移することを確認
    await expect(page).toHaveURL('/dashboard');
  });

  test('3.1-03 ダッシュボードにユーザー名とトークン残数が表示される', async ({ page }) => {
    // 認証済み状態でダッシュボードにアクセス
    await page.goto('/login');
    
    // 認証状態のモック設定
    await page.evaluate(() => {
      localStorage.setItem('mockAuthUser', JSON.stringify({
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      }));
    });

    await page.goto('/dashboard');
    
    // ユーザー名が表示されることを確認
    await expect(page.locator('text=Test User')).toBeVisible();
    
    // トークン残数表示エリアが存在することを確認
    await expect(page.locator('text=所持トークン')).toBeVisible();
    
    // 「トークン購入」ボタンが表示されることを確認
    await expect(page.locator('button:has-text("トークン購入")').or(page.locator('a:has-text("トークン購入")'))).toBeVisible();
    
    // 「スタンプ作成を始める」ボタンが表示されることを確認
    await expect(page.locator('button:has-text("スタンプ作成を始める")').or(page.locator('a:has-text("スタンプ作成を始める")'))).toBeVisible();
  });

  test('3.1-04 ログアウトボタン押下でログインページに戻る', async ({ page }) => {
    // 認証済み状態でダッシュボードにアクセス
    await page.goto('/login');
    
    // 認証状態のモック設定
    await page.evaluate(() => {
      localStorage.setItem('mockAuthUser', JSON.stringify({
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      }));
    });

    await page.goto('/dashboard');
    
    // ログアウトボタンをクリック
    await page.click('button:has-text("ログアウト")');
    
    // ログインページに遷移することを確認
    await expect(page).toHaveURL('/login');
    
    // 認証状態がクリアされることを確認
    const authState = await page.evaluate(() => {
      return localStorage.getItem('mockAuthUser');
    });
    expect(authState).toBeNull();
  });

  test('認証なしでダッシュボードアクセス時にログインページへリダイレクト', async ({ page }) => {
    // 認証状態をクリア
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('mockAuthUser');
    });

    // ダッシュボードに直接アクセス
    await page.goto('/dashboard');
    
    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL('/login');
  });
}); 