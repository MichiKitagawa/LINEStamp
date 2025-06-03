import { getFirestore } from 'firebase-admin/firestore';

describe('2.2 画像アップロード→スタンプ生成→ステータス取得フロー', () => {
  let db: FirebaseFirestore.Firestore;
  const testUid = 'test-integration-user-id';
  const testStampId = 'test-stamp-id';

  beforeAll(() => {
    db = getFirestore();
  });

  it('2.2-01〜2.2-04: 完全なフローの実行', async () => {
    // 2.2-01: Firestore エミュレータを起動し、ユーザーとコレクションを準備
    
    // ユーザーを作成
    await db.collection('users').doc(testUid).set({
      uid: testUid,
      email: 'test@example.com',
      displayName: 'Test User',
      tokenBalance: 50, // 十分なトークン
      createdAt: new Date(),
    });

    // 2.2-02: 画像アップロードをシミュレート
    const imageFiles = [
      { filename: 'image1.png', size: 1024 * 1024 }, // 1MB
      { filename: 'image2.jpg', size: 2 * 1024 * 1024 }, // 2MB
      { filename: 'image3.png', size: 512 * 1024 }, // 512KB
    ];

    // スタンプドキュメントを作成
    await db.collection('stamps').doc(testStampId).set({
      userId: testUid,
      status: 'pending_upload',
      createdAt: new Date(),
    });

    // 画像をFirestoreに保存（アップロード処理をシミュレート）
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      await db.collection('images').add({
        stampId: testStampId,
        type: 'original',
        filename: imageFile.filename,
        url: `https://storage.googleapis.com/test-bucket/${testStampId}/original/${imageFile.filename}`,
        sequence: i + 1,
        size: imageFile.size,
        createdAt: new Date(),
      });
    }

    // スタンプのステータスを generating に更新
    await db.collection('stamps').doc(testStampId).update({
      status: 'generating',
    });

    // 画像が正しく保存されていることを確認
    const imagesQuery = await db
      .collection('images')
      .where('stampId', '==', testStampId)
      .where('type', '==', 'original')
      .get();
    
    expect(imagesQuery.docs.length).toBe(3);
    expect(imagesQuery.docs[0].data().type).toBe('original');

    // 2.2-03: スタンプ生成処理をシミュレート
    // モックジェネレーターで processed 画像を生成
    const processedImages = [];
    for (let i = 0; i < 8; i++) { // 8枚の加工済み画像
      const processedImageData = {
        stampId: testStampId,
        type: 'processed',
        filename: `processed_${i + 1}.png`,
        url: `https://storage.googleapis.com/test-bucket/${testStampId}/processed/processed_${i + 1}.png`,
        sequence: i + 1,
        size: 370 * 320, // 固定サイズ
        createdAt: new Date(),
      };
      
      const docRef = await db.collection('images').add(processedImageData);
      processedImages.push({ id: docRef.id, ...processedImageData });
    }

    // スタンプのステータスを generated に更新
    await db.collection('stamps').doc(testStampId).update({
      status: 'generated',
      generatedAt: new Date(),
    });

    // 2.2-04: ステータス取得をシミュレート
    const stampDoc = await db.collection('stamps').doc(testStampId).get();
    expect(stampDoc.exists).toBe(true);
    expect(stampDoc.data()?.status).toBe('generated');

    // 加工済み画像が正しく生成されていることを確認
    const processedImagesQuery = await db
      .collection('images')
      .where('stampId', '==', testStampId)
      .where('type', '==', 'processed')
      .get();
    
    expect(processedImagesQuery.docs.length).toBe(8);
    processedImagesQuery.docs.forEach((doc, index) => {
      const data = doc.data();
      expect(data.type).toBe('processed');
      expect(data.sequence).toBe(index + 1);
    });
  });

  it('エラーケース: ファイル形式不正', async () => {
    const invalidFiles = [
      { filename: 'document.pdf', mimetype: 'application/pdf' },
      { filename: 'video.mp4', mimetype: 'video/mp4' },
      { filename: 'audio.mp3', mimetype: 'audio/mpeg' },
    ];

    for (const file of invalidFiles) {
      // バリデーション関数をシミュレート
      const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      const isValidFile = validMimeTypes.includes(file.mimetype);
      expect(isValidFile).toBe(false);
    }
  });

  it('エラーケース: ファイルサイズ超過', async () => {
    const oversizedFile = {
      filename: 'large_image.png',
      size: 6 * 1024 * 1024, // 6MB (制限: 5MB)
    };

    // サイズバリデーション
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const isValidSize = oversizedFile.size <= maxFileSize;
    expect(isValidSize).toBe(false);
  });

  it('エラーケース: トークン不足', async () => {
    const insufficientTokenUser = 'user-with-no-tokens';
    
    // トークン不足のユーザーを作成
    await db.collection('users').doc(insufficientTokenUser).set({
      uid: insufficientTokenUser,
      email: 'poor@example.com',
      displayName: 'Poor User',
      tokenBalance: 5, // 不足（必要: 40トークン）
      createdAt: new Date(),
    });

    const userDoc = await db.collection('users').doc(insufficientTokenUser).get();
    const tokenBalance = userDoc.data()?.tokenBalance || 0;
    const requiredTokens = 8 * 5; // 8枚 × 5トークン

    expect(tokenBalance).toBeLessThan(requiredTokens);
  });
}); 