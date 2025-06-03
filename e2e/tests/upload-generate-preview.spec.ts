import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('3.3 アップロード → 生成 → プレビュー', () => {
  
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

    // API モックの設定
    await page.route('**/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'test-user-id',
          displayName: 'Test User',
          email: 'test@example.com',
          tokenBalance: 100
        })
      });
    });
  });

  test('3.3-01 ダッシュボードからアップロードページへ遷移', async ({ page }) => {
    // ダッシュボードにアクセス
    await page.goto('/dashboard');
    
    // 「スタンプ作成を始める」ボタンをクリック
    await page.click('a:has-text("スタンプ作成を始める"), button:has-text("スタンプ作成を始める")');
    
    // アップロードページに遷移することを確認
    await expect(page).toHaveURL('/upload');
    
    // ページタイトルの確認
    await expect(page).toHaveTitle(/画像アップロード/);
  });

  test('3.3-02 ダミーPNGを3枚選択してバリデーションOK', async ({ page }) => {
    // アップロードページにアクセス
    await page.goto('/upload');
    
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // ファイル選択エリアが表示されることを確認
    await expect(page.locator('input[type="file"]')).toBeVisible();
    
    // テスト用の画像ファイルを作成（実際のプロジェクトでは事前に用意）
    const testFiles = [
      {
        name: 'test1.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG file content')
      },
      {
        name: 'test2.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG file content')
      },
      {
        name: 'test3.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG file content')
      }
    ];

    // ファイル入力要素にファイルを設定
    await page.setInputFiles('input[type="file"]', testFiles);
    
    // 選択されたファイルが表示されることを確認
    await expect(page.locator('text=test1.png')).toBeVisible();
    await expect(page.locator('text=test2.png')).toBeVisible();
    await expect(page.locator('text=test3.png')).toBeVisible();
    
    // バリデーション成功メッセージまたは「次へ」ボタンが有効になることを確認
    const nextButton = page.locator('button:has-text("次へ")');
    await expect(nextButton).toBeEnabled();
  });

  test('3.3-03 「次へ（生成開始）」クリックで生成ページへ遷移', async ({ page }) => {
    // 画像アップロードAPIのモック
    await page.route('**/images/upload', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stampId: 'test-stamp-id-12345',
          uploadedCount: 3,
          status: 'generating'
        })
      });
    });

    // アップロードページにアクセス
    await page.goto('/upload');
    
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // ファイルを選択
    await page.setInputFiles('input[type="file"]', [
      {
        name: 'test1.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG file content')
      },
      {
        name: 'test2.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG file content')
      },
      {
        name: 'test3.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG file content')
      }
    ]);
    
    // 「次へ（生成開始）」ボタンをクリック
    await page.click('button:has-text("次へ")');
    
    // 生成中ページに遷移することを確認
    await expect(page).toHaveURL(/\/generating/);
  });

  test('3.3-04 ステータスポーリングでgenerated状態まで待機', async ({ page }) => {
    let statusCallCount = 0;
    
    // ステータスAPIのモック（段階的にステータスを変化させる）
    await page.route('**/stamps/*/status', async route => {
      statusCallCount++;
      
      if (statusCallCount <= 2) {
        // 最初の数回は生成中
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stampId: 'test-stamp-id-12345',
            status: 'generating',
            retryCount: 0
          })
        });
      } else {
        // 3回目以降は生成完了
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stampId: 'test-stamp-id-12345',
            status: 'generated',
            retryCount: 0
          })
        });
      }
    });

    // トークン消費APIのモック
    await page.route('**/tokens/consume', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          remainingBalance: 60
        })
      });
    });

    // 生成開始APIのモック
    await page.route('**/stamps/generate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stampId: 'test-stamp-id-12345',
          status: 'generating'
        })
      });
    });

    // 生成中ページにアクセス
    await page.goto('/generating?stampId=test-stamp-id-12345');
    
    // ローディングスピナーが表示されることを確認
    await expect(page.locator('text=生成中')).toBeVisible();
    
    // ステータスがgeneratedになるまで待機
    await page.waitForURL(/\/preview\/test-stamp-id-12345/, { timeout: 10000 });
  });

  test('3.3-05 プレビューページで8枚の画像が表示される', async ({ page }) => {
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

    // プレビューページにアクセス
    await page.goto('/preview/test-stamp-id-12345');
    
    // 8枚の画像が表示されることを確認
    const imageElements = page.locator('img[src*="processed-"]');
    await expect(imageElements).toHaveCount(8);
    
    // 申請ボタンが表示されることを確認
    await expect(page.locator('button:has-text("申請")')).toBeVisible();
  });

  test('エラーケース: ファイル形式不正', async ({ page }) => {
    // アップロードページにアクセス
    await page.goto('/upload');
    
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // 不正なファイル形式を選択
    await page.setInputFiles('input[type="file"]', [{
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not an image')
    }]);
    
    // エラーメッセージが表示されることを確認（実装に合わせて調整）
    await expect(page.locator('text=PNGまたはJPEG形式, text=ファイルが無効, text=形式, text=JPEG')).toBeVisible();
  });

  test('エラーケース: トークン不足', async ({ page }) => {
    // トークン残高不足のモック
    await page.route('**/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'test-user-id',
          displayName: 'Test User',
          email: 'test@example.com',
          tokenBalance: 10 // 不足
        })
      });
    });

    // アップロードページにアクセス
    await page.goto('/upload');
    
    // ファイルを選択
    await page.setInputFiles('input[type="file"]', [
      {
        name: 'test1.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG file content')
      }
    ]);
    
    // トークン不足の警告が表示されることを確認
    await expect(page.locator('text=トークンが不足しています')).toBeVisible();
    
    // トークン購入への誘導リンクが表示されることを確認
    await expect(page.locator('a:has-text("トークンを購入する")')).toBeVisible();
  });
}); 