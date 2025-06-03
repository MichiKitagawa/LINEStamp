/**
 * Puppeteer申請サービスのインターフェース
 * 将来的に実際のPuppeteer処理と差し替える際に使用
 */
export interface PuppeteerSubmissionService {
  submitStamp(stampId: string): Promise<void>;
}

/**
 * モックPuppeteer申請サービス
 * 実際のLINE Creators Market申請の代わりに、モック処理を実行
 */
export class PuppeteerSubmissionMock implements PuppeteerSubmissionService {
  /**
   * スタンプ申請をモック実行
   * @param stampId スタンプID
   */
  async submitStamp(stampId: string): Promise<void> {
    console.log(`Mock Puppeteer submission started for stamp ${stampId}`);
    
    try {
      // モックログを生成して保存
      const logs = [
        'Puppeteer 起動中...',
        'Chromium ブラウザを起動しています...',
        'LINE Creators Market にアクセス中...',
        'LINEアカウントでログイン中...',
        'スタンプ申請フォームを開いています...',
        'メタデータを入力中...',
        '画像をアップロード中...',
        'フォームを送信中...',
      ];

      // 段階的にログを更新（本来はFirestoreの別コレクションに保存）
      for (let i = 0; i < logs.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒待機
        console.log(`[${stampId}] ${logs[i]}`);
      }

      // 最終的にsubmittedステータスに更新（5秒後）
      await new Promise(resolve => setTimeout(resolve, 2000)); // 追加で2秒待機

      console.log(`Mock Puppeteer submission completed for stamp ${stampId}`);
    } catch (error) {
      console.error(`Mock Puppeteer submission failed for stamp ${stampId}:`, error);
      throw error;
    }
  }
}

/**
 * デフォルトのPuppeteer申請サービスインスタンス
 */
export const puppeteerSubmissionService: PuppeteerSubmissionService = new PuppeteerSubmissionMock(); 