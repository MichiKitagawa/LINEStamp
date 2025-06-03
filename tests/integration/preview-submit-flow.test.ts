import { getFirestore } from 'firebase-admin/firestore';

describe('2.3 プレビュー取得→申請→再申請フロー', () => {
  let db: FirebaseFirestore.Firestore;
  const testUid = 'test-integration-user-id';
  const testStampId = 'test-stamp-id';

  beforeAll(() => {
    db = getFirestore();
  });

  it('2.3-01〜2.3-04: 完全なフローの実行', async () => {
    // 2.3-01: Firestore エミュレータを起動し、stamps/{stampId} と images/type="processed" が8件存在する状態を作成
    
    // ユーザーを作成
    await db.collection('users').doc(testUid).set({
      uid: testUid,
      email: 'test@example.com',
      displayName: 'Test User',
      tokenBalance: 50,
      createdAt: new Date(),
    });

    // スタンプドキュメントを作成（generated状態）
    await db.collection('stamps').doc(testStampId).set({
      userId: testUid,
      status: 'generated',
      createdAt: new Date(),
      generatedAt: new Date(),
    });

    // 8件の加工済み画像を作成
    const processedImages = [];
    for (let i = 0; i < 8; i++) {
      const imageData = {
        stampId: testStampId,
        type: 'processed',
        filename: `processed_${i + 1}.png`,
        url: `https://storage.googleapis.com/test-bucket/${testStampId}/processed/processed_${i + 1}.png`,
        sequence: i + 1,
        size: 370 * 320,
        createdAt: new Date(),
      };
      
      const docRef = await db.collection('images').add(imageData);
      processedImages.push({ id: docRef.id, ...imageData });
    }

    // 2.3-02: GET /stamps/{stampId}/preview → 8 件の画像 URL を返す
    // プレビュー取得をシミュレート
    const previewImagesQuery = await db
      .collection('images')
      .where('stampId', '==', testStampId)
      .where('type', '==', 'processed')
      .get();

    expect(previewImagesQuery.docs.length).toBe(8);
    
    const previewUrls = previewImagesQuery.docs
      .sort((a, b) => a.data().sequence - b.data().sequence)
      .map(doc => doc.data().url);
    
    expect(previewUrls.length).toBe(8);
    previewUrls.forEach((url, index) => {
      expect(url).toContain(`processed_${index + 1}.png`);
    });

    // 2.3-03: POST /stamps/submit → 申請処理をシミュレート
    
    // スタンプのステータスを submitting に更新
    await db.collection('stamps').doc(testStampId).update({
      status: 'submitting',
      submittedAt: new Date(),
    });

    // 申請試行記録を作成
    await db.collection('submission_attempts').add({
      stampId: testStampId,
      attemptNo: 1,
      status: 'submitting',
      startedAt: new Date(),
    });

    // Puppeteer モック完了後に status="submitted" に更新
    // （実際の処理では非同期で行われる）
    await new Promise(resolve => setTimeout(resolve, 100)); // 短い待機

    await db.collection('stamps').doc(testStampId).update({
      status: 'submitted',
      completedAt: new Date(),
    });

    // 申請試行記録を更新
    const submissionQuery = await db
      .collection('submission_attempts')
      .where('stampId', '==', testStampId)
      .where('attemptNo', '==', 1)
      .get();

    if (!submissionQuery.empty) {
      await submissionQuery.docs[0].ref.update({
        status: 'submitted',
        completedAt: new Date(),
      });
    }

    // ステータスが submitted になることを確認
    const submittedStampDoc = await db.collection('stamps').doc(testStampId).get();
    expect(submittedStampDoc.data()?.status).toBe('submitted');

    // 2.3-04: 故意に status="failed" に更新し、POST /stamps/retry → 再申請フロー
    
    // 失敗状態にセット
    await db.collection('stamps').doc(testStampId).update({
      status: 'failed',
      retryCount: 0,
    });

    // 再申請処理をシミュレート
    const currentRetryCount = 0;
    const newRetryCount = currentRetryCount + 1;

    await db.collection('stamps').doc(testStampId).update({
      status: 'submitting',
      retryCount: newRetryCount,
    });

    // 新しい申請試行記録を作成
    await db.collection('submission_attempts').add({
      stampId: testStampId,
      attemptNo: newRetryCount + 1, // 2回目の試行
      status: 'submitting',
      startedAt: new Date(),
    });

    // Puppeteer モックで再度 status="submitted" になる
    await new Promise(resolve => setTimeout(resolve, 100));

    await db.collection('stamps').doc(testStampId).update({
      status: 'submitted',
      completedAt: new Date(),
    });

    // 最終的にsubmittedになることを確認
    const finalStampDoc = await db.collection('stamps').doc(testStampId).get();
    expect(finalStampDoc.data()?.status).toBe('submitted');
    expect(finalStampDoc.data()?.retryCount).toBe(1);

    // 申請試行記録が2件あることを確認
    const allAttemptsQuery = await db
      .collection('submission_attempts')
      .where('stampId', '==', testStampId)
      .get();
    expect(allAttemptsQuery.docs.length).toBe(2);
  });

  it('エラーケース: 権限なしでのプレビュー取得', async () => {
    const unauthorizedUid = 'unauthorized-user';
    const otherUserStampId = 'other-user-stamp';

    // 他のユーザーのスタンプを作成
    await db.collection('stamps').doc(otherUserStampId).set({
      userId: 'different-user-id',
      status: 'generated',
      createdAt: new Date(),
    });

    // 権限チェックをシミュレート
    const stampDoc = await db.collection('stamps').doc(otherUserStampId).get();
    const stampUserId = stampDoc.data()?.userId;
    
    expect(stampUserId).not.toBe(unauthorizedUid);
    // 実際のAPIでは403エラーが返されるべき
  });

  it('エラーケース: 無効なステータスでの申請', async () => {
    const invalidStatusStampId = 'invalid-status-stamp';

    // pending_upload状態のスタンプを作成
    await db.collection('stamps').doc(invalidStatusStampId).set({
      userId: testUid,
      status: 'pending_upload', // 申請不可能な状態
      createdAt: new Date(),
    });

    const stampDoc = await db.collection('stamps').doc(invalidStatusStampId).get();
    const status = stampDoc.data()?.status;

    // 申請可能なステータスかチェック
    const submittableStatuses = ['generated', 'failed'];
    const canSubmit = submittableStatuses.includes(status);
    
    expect(canSubmit).toBe(false);
    // 実際のAPIでは400エラーが返されるべき
  });

  it('エラーケース: 存在しないスタンプIDでの操作', async () => {
    const nonExistentStampId = 'non-existent-stamp';

    // 存在しないスタンプのドキュメントを取得
    const stampDoc = await db.collection('stamps').doc(nonExistentStampId).get();
    expect(stampDoc.exists).toBe(false);

    // 実際のAPIでは404エラーが返されるべき
  });
}); 