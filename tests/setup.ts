// Firebase Admin のモック設定
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({ 
    name: 'test-app',
    options: { projectId: 'line-stamp-test' }
  })),
  getApps: jest.fn(() => []),
  deleteApp: jest.fn(),
  getApp: jest.fn(() => ({ 
    name: 'test-app',
    options: { projectId: 'line-stamp-test' }
  })),
}));

// グローバルなモックデータストレージ
let mockDocData = new Map();

jest.mock('firebase-admin/firestore', () => {
  const mockDoc = (path: string) => ({
    id: path.split('/').pop(),
    get: jest.fn(async () => ({
      exists: mockDocData.has(path),
      data: () => mockDocData.get(path),
      id: path.split('/').pop(),
    })),
    set: jest.fn(async (data: any) => {
      mockDocData.set(path, data);
    }),
    update: jest.fn(async (data: any) => {
      const existing = mockDocData.get(path) || {};
      mockDocData.set(path, { ...existing, ...data });
    }),
    delete: jest.fn(async () => {
      mockDocData.delete(path);
    }),
  });

  const createQueryMock = (collectionPath: string, filters: Array<{field: string, op: string, value: any}> = []): any => ({
    where: jest.fn((field: string, op: string, value: any): any => {
      const newFilters = [...filters, { field, op, value }];
      return createQueryMock(collectionPath, newFilters);
    }),
    get: jest.fn(async () => {
      let docs = Array.from(mockDocData.entries())
        .filter(([path]) => path.startsWith(collectionPath))
        .map(([path, data]) => ({
          id: path.split('/').pop(),
          data: () => data,
          ref: mockDoc(path),
        }));

      // フィルターを適用
      for (const filter of filters) {
        docs = docs.filter(doc => {
          const docData = doc.data();
          const fieldValue = docData[filter.field];
          
          switch (filter.op) {
            case '==':
              return fieldValue === filter.value;
            case '!=':
              return fieldValue !== filter.value;
            case '>':
              return fieldValue > filter.value;
            case '>=':
              return fieldValue >= filter.value;
            case '<':
              return fieldValue < filter.value;
            case '<=':
              return fieldValue <= filter.value;
            case 'array-contains':
              return Array.isArray(fieldValue) && fieldValue.includes(filter.value);
            default:
              return true;
          }
        });
      }

      return {
        docs,
        empty: docs.length === 0,
      };
    }),
  });

  const mockCollection = (collectionPath: string) => ({
    doc: jest.fn((docId?: string) => {
      const docPath = docId ? `${collectionPath}/${docId}` : `${collectionPath}/auto-${Date.now()}-${Math.random()}`;
      return mockDoc(docPath);
    }),
    add: jest.fn(async (data: any) => {
      const docPath = `${collectionPath}/auto-${Date.now()}-${Math.random()}`;
      mockDocData.set(docPath, data);
      return mockDoc(docPath);
    }),
    where: jest.fn((field: string, op: string, value: any) => {
      return createQueryMock(collectionPath, [{ field, op, value }]);
    }),
    get: jest.fn(async () => ({
      docs: Array.from(mockDocData.entries())
        .filter(([path]) => path.startsWith(collectionPath))
        .map(([path, data]) => ({
          id: path.split('/').pop(),
          data: () => data,
          ref: mockDoc(path),
        })),
      empty: mockDocData.size === 0,
    })),
  });

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn((collectionPath: string) => mockCollection(collectionPath)),
      doc: jest.fn((docPath: string) => mockDoc(docPath)),
      runTransaction: jest.fn(async (callback: any) => {
        // 簡単なトランザクションモック
        const transaction = {
          get: jest.fn(async (ref: any) => ref.get()),
          set: jest.fn(async (ref: any, data: any) => ref.set(data)),
          update: jest.fn(async (ref: any, data: any) => ref.update(data)),
          delete: jest.fn(async (ref: any) => ref.delete()),
        };
        return await callback(transaction);
      }),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn(async () => {}),
      })),
    })),
  };
});

// グローバルセットアップ
beforeAll(async () => {
  console.log('Integration test environment initialized (mocked)');
});

// 各テスト後のクリーンアップ
afterEach(async () => {
  // モックデータをクリア
  mockDocData.clear();
  jest.clearAllMocks();
});

// 全テスト後のクリーンアップ
afterAll(async () => {
  console.log('Integration test environment cleaned up');
});

// タイムアウト延長
jest.setTimeout(30000); 