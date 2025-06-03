import { test, expect } from '@playwright/test';

test.describe('3.4 プレビュー → 申請 → ステータス → 完了/エラー/再認証', () => {
  
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

    // プレビューAPIのモック
    await page.route('**/stamps/*/preview', async route => {
      const images: any[] = [];
      for (let i = 0; i < 8; i++) {
        images.push({
          url: `https://storage.googleapis.com/test-bucket/processed-${i}.png`,
          sequence: i,
          type: 'processed'
        });
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images,
          mainImage: null
        })
      });
    });
  });

  test.describe('シナリオ A: 正常フロー', () => {
    
    test('3.4.1-01 プレビューページで申請ボタンクリック', async ({ page }) => {
      // 申請APIのモック
      await page.route('**/stamps/submit', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stampId: 'test-stamp-id-12345',
            status: 'submitting'
          })
        });
      });

      // プレビューページにアクセス
      await page.goto('/preview/test-stamp-id-12345');
      
      // 8枚の画像が表示されることを確認
      const imageElements = page.locator('img[src*="processed-"]');
      await expect(imageElements).toHaveCount(8);
      
      // 申請ボタンをクリック
      await page.click('button:has-text("申請")');
      
      // ステータスページに遷移することを確認
      await expect(page).toHaveURL('/status/test-stamp-id-12345');
    });

    test('3.4.1-02 ステータスページでsubmittedになり成功ページへ遷移', async ({ page }) => {
      let statusCallCount = 0;
      
      // ステータスAPIのモック（段階的にステータスを変化させる）
      await page.route('**/stamps/*/status', async route => {
        statusCallCount++;
        
        if (statusCallCount <= 2) {
          // 最初の数回は申請中
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              stampId: 'test-stamp-id-12345',
              status: 'submitting',
              retryCount: 0
            })
          });
        } else {
          // 3回目以降は申請完了
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              stampId: 'test-stamp-id-12345',
              status: 'submitted',
              retryCount: 0
            })
          });
        }
      });

      // ステータスページにアクセス
      await page.goto('/status/test-stamp-id-12345');
      
      // 申請中のメッセージが表示されることを確認
      await expect(page.locator('text=申請中')).toBeVisible();
      
      // ステータスがsubmittedになり成功ページに遷移することを確認
      await page.waitForURL('/success/test-stamp-id-12345', { timeout: 10000 });
    });

    test('3.4.1-03 成功ページで完了メッセージが表示される', async ({ page }) => {
      // 成功ページにアクセス
      await page.goto('/success/test-stamp-id-12345');
      
      // 完了メッセージが表示されることを確認
      await expect(page.locator('text=申請が完了しました')).toBeVisible();
      
      // ダッシュボードへ戻るリンクが表示されることを確認
      await expect(page.locator('a:has-text("ダッシュボードへ戻る")')).toBeVisible();
      
      // 新しいスタンプ作成リンクが表示されることを確認
      await expect(page.locator('a:has-text("新しいスタンプを作成")')).toBeVisible();
    });
  });

  test.describe('シナリオ B: 申請失敗→再申請', () => {
    
    test('3.4.2-01 申請失敗でエラーページに遷移', async ({ page }) => {
      // ステータスAPIのモック（失敗ステータスを返す）
      await page.route('**/stamps/*/status', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stampId: 'test-stamp-id-12345',
            status: 'failed',
            retryCount: 0
          })
        });
      });

      // ステータスページにアクセス
      await page.goto('/status/test-stamp-id-12345');
      
      // エラーページに遷移することを確認
      await page.waitForURL('/error/test-stamp-id-12345', { timeout: 10000 });
    });

    test('3.4.2-02 エラーページで再申請ボタンクリック', async ({ page }) => {
      // 再申請APIのモック
      await page.route('**/stamps/retry', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stampId: 'test-stamp-id-12345',
            status: 'submitting',
            retryCount: 1
          })
        });
      });

      // エラーページにアクセス
      await page.goto('/error/test-stamp-id-12345');
      
      // 再申請ボタンが表示されることを確認
      await expect(page.locator('button:has-text("再申請する")')).toBeVisible();
      
      // 再申請ボタンをクリック
      await page.click('button:has-text("再申請する")');
      
      // ステータスページに戻ることを確認
      await expect(page).toHaveURL('/status/test-stamp-id-12345');
    });

    test('3.4.2-03 再申請成功で成功ページに遷移', async ({ page }) => {
      let statusCallCount = 0;
      
      // ステータスAPIのモック（再申請後成功）
      await page.route('**/stamps/*/status', async route => {
        statusCallCount++;
        
        if (statusCallCount <= 1) {
          // 最初は再申請中
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              stampId: 'test-stamp-id-12345',
              status: 'submitting',
              retryCount: 1
            })
          });
        } else {
          // 2回目以降は成功
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              stampId: 'test-stamp-id-12345',
              status: 'submitted',
              retryCount: 1
            })
          });
        }
      });

      // ステータスページにアクセス
      await page.goto('/status/test-stamp-id-12345');
      
      // 成功ページに遷移することを確認
      await page.waitForURL('/success/test-stamp-id-12345', { timeout: 10000 });
      
      // 完了メッセージが表示されることを確認
      await expect(page.locator('text=申請が完了しました')).toBeVisible();
    });
  });

  test.describe('シナリオ C: セッション切れ→再認証フォールバック', () => {
    
    test('3.4.3-01 セッション切れで再認証ページに遷移', async ({ page }) => {
      // ステータスAPIのモック（セッション切れステータスを返す）
      await page.route('**/stamps/*/status', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stampId: 'test-stamp-id-12345',
            status: 'session_expired',
            retryCount: 0
          })
        });
      });

      // ステータスページにアクセス
      await page.goto('/status/test-stamp-id-12345');
      
      // 再認証ページに遷移することを確認
      await page.waitForURL('/relogin/test-stamp-id-12345', { timeout: 10000 });
    });

    test('3.4.3-02 再認証ページでLINEログインメッセージ表示', async ({ page }) => {
      // 再認証ページにアクセス
      await page.goto('/relogin/test-stamp-id-12345');
      
      // LINEログインメッセージが表示されることを確認
      await expect(page.locator('text=LINEにログインしてください')).toBeVisible();
      
      // 自動再開メッセージが表示されることを確認
      await expect(page.locator('text=ログイン完了後、自動で申請を再開します')).toBeVisible();
      
      // キャンセルボタンが表示されることを確認
      await expect(page.locator('button:has-text("キャンセル")')).toBeVisible();
    });

    test('3.4.3-03 5秒後の自動再申請で成功ページへ遷移', async ({ page }) => {
      // 再申請APIのモック
      await page.route('**/stamps/submit', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stampId: 'test-stamp-id-12345',
            status: 'submitted'
          })
        });
      });

      // 再認証ページにアクセス
      await page.goto('/relogin/test-stamp-id-12345');
      
      // 5秒後の自動再申請を待機
      await page.waitForURL('/success/test-stamp-id-12345', { timeout: 10000 });
      
      // 成功ページで完了メッセージが表示されることを確認
      await expect(page.locator('text=申請が完了しました')).toBeVisible();
    });

    test('3.4.3-04 キャンセルボタンでエラーページに戻る', async ({ page }) => {
      // 再認証ページにアクセス
      await page.goto('/relogin/test-stamp-id-12345');
      
      // キャンセルボタンをクリック
      await page.click('button:has-text("キャンセル")');
      
      // エラーページに戻ることを確認
      await expect(page).toHaveURL('/error/test-stamp-id-12345');
    });
  });
}); 