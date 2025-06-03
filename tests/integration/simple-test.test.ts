import { getFirestore } from 'firebase-admin/firestore';

describe('Simple Test', () => {
  it('should connect to Firestore emulator', async () => {
    const db = getFirestore();
    
    // 簡単な読み書きテスト
    const testDoc = db.collection('test').doc('simple');
    await testDoc.set({ message: 'Hello, World!' });
    
    const doc = await testDoc.get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.message).toBe('Hello, World!');
    
    // クリーンアップ
    await testDoc.delete();
  });

  it('should perform basic calculations', () => {
    expect(2 + 2).toBe(4);
    expect(Math.max(1, 2, 3)).toBe(3);
  });
}); 