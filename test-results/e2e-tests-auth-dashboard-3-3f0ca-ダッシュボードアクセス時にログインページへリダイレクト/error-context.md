# Test info

- Name: 3.1 認証 → ダッシュボード >> 認証なしでダッシュボードアクセス時にログインページへリダイレクト
- Location: C:\Users\k0803\Projects\LINEStamp\e2e\tests\auth-dashboard.spec.ts:94:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/login", waiting until "load"

    at C:\Users\k0803\Projects\LINEStamp\e2e\tests\auth-dashboard.spec.ts:96:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('3.1 認証 → ダッシュボード', () => {
   4 |   
   5 |   test('3.1-01 ログインページに「Google でログイン」ボタンが表示される', async ({ page }) => {
   6 |     // ログインページにアクセス
   7 |     await page.goto('/login');
   8 |     
   9 |     // 「Google でログイン」ボタンが表示されることを確認
   10 |     const loginButton = page.locator('button:has-text("Google でログイン")');
   11 |     await expect(loginButton).toBeVisible();
   12 |     
   13 |     // ページタイトルの確認
   14 |     await expect(page).toHaveTitle(/ログイン/);
   15 |   });
   16 |
   17 |   test('3.1-02 Google ログインモックからダッシュボードに遷移', async ({ page }) => {
   18 |     // ローカルストレージに認証状態をモック設定
   19 |     await page.goto('/login');
   20 |     
   21 |     // Firebase認証のモック設定
   22 |     await page.evaluate(() => {
   23 |       // モックユーザーデータをlocalStorageに設定
   24 |       localStorage.setItem('mockAuthUser', JSON.stringify({
   25 |         uid: 'test-user-id',
   26 |         email: 'test@example.com',
   27 |         displayName: 'Test User'
   28 |       }));
   29 |     });
   30 |
   31 |     // 「Google でログイン」ボタンをクリック
   32 |     await page.click('button:has-text("Google でログイン")');
   33 |     
   34 |     // ダッシュボードページに遷移することを確認
   35 |     await expect(page).toHaveURL('/dashboard/');
   36 |   });
   37 |
   38 |   test('3.1-03 ダッシュボードにユーザー名とトークン残数が表示される', async ({ page }) => {
   39 |     // 認証済み状態でダッシュボードにアクセス
   40 |     await page.goto('/login');
   41 |     
   42 |     // 認証状態のモック設定
   43 |     await page.evaluate(() => {
   44 |       localStorage.setItem('mockAuthUser', JSON.stringify({
   45 |         uid: 'test-user-id',
   46 |         email: 'test@example.com',
   47 |         displayName: 'Test User'
   48 |       }));
   49 |     });
   50 |
   51 |     await page.goto('/dashboard');
   52 |     
   53 |     // ユーザー名が表示されることを確認
   54 |     await expect(page.locator('text=Test User')).toBeVisible();
   55 |     
   56 |     // トークン残数表示エリアが存在することを確認
   57 |     await expect(page.locator('text=トークン残数')).toBeVisible();
   58 |     
   59 |     // 「トークンを購入」ボタンが表示されることを確認
   60 |     await expect(page.locator('button:has-text("トークンを購入")').or(page.locator('a:has-text("トークンを購入")'))).toBeVisible();
   61 |     
   62 |     // 「スタンプ作成を始める」ボタンが表示されることを確認
   63 |     await expect(page.locator('button:has-text("スタンプ作成を始める")').or(page.locator('a:has-text("スタンプ作成を始める")'))).toBeVisible();
   64 |   });
   65 |
   66 |   test('3.1-04 ログアウトボタン押下でログインページに戻る', async ({ page }) => {
   67 |     // 認証済み状態でダッシュボードにアクセス
   68 |     await page.goto('/login');
   69 |     
   70 |     // 認証状態のモック設定
   71 |     await page.evaluate(() => {
   72 |       localStorage.setItem('mockAuthUser', JSON.stringify({
   73 |         uid: 'test-user-id',
   74 |         email: 'test@example.com',
   75 |         displayName: 'Test User'
   76 |       }));
   77 |     });
   78 |
   79 |     await page.goto('/dashboard');
   80 |     
   81 |     // ログアウトボタンをクリック
   82 |     await page.click('button:has-text("ログアウト")');
   83 |     
   84 |     // ログインページに遷移することを確認
   85 |     await expect(page).toHaveURL('/login/');
   86 |     
   87 |     // 認証状態がクリアされることを確認
   88 |     const authState = await page.evaluate(() => {
   89 |       return localStorage.getItem('mockAuthUser');
   90 |     });
   91 |     expect(authState).toBeNull();
   92 |   });
   93 |
   94 |   test('認証なしでダッシュボードアクセス時にログインページへリダイレクト', async ({ page }) => {
   95 |     // 認証状態をクリア
>  96 |     await page.goto('/login');
      |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
   97 |     await page.evaluate(() => {
   98 |       localStorage.removeItem('mockAuthUser');
   99 |     });
  100 |
  101 |     // ダッシュボードに直接アクセス
  102 |     await page.goto('/dashboard');
  103 |     
  104 |     // ログインページにリダイレクトされることを確認
  105 |     await expect(page).toHaveURL('/login/');
  106 |   });
  107 | }); 
```