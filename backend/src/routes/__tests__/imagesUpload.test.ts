import request from 'supertest';
import express from 'express';

// Firebase Admin SDK をモック
jest.mock('../../utils/firebaseAdmin', () => ({
  firestore: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

// Storage client をモック
jest.mock('../../utils/storageClient', () => ({
  uploadFileToStorage: jest.fn(),
  generateStoragePath: jest.fn(),
  sanitizeFilename: jest.fn(),
}));

import imagesRoutes from '../images';
import { firestore } from '../../utils/firebaseAdmin';
import { uploadFileToStorage, generateStoragePath, sanitizeFilename } from '../../utils/storageClient';

const mockFirestore = firestore as jest.Mocked<typeof firestore>;
const mockUploadFileToStorage = uploadFileToStorage as jest.MockedFunction<typeof uploadFileToStorage>;
const mockGenerateStoragePath = generateStoragePath as jest.MockedFunction<typeof generateStoragePath>;
const mockSanitizeFilename = sanitizeFilename as jest.MockedFunction<typeof sanitizeFilename>;

// Express アプリを設定
const app = express();
app.use(express.json());
app.use('/images', imagesRoutes);

// 認証ミドルウェアをモック
jest.mock('../../middleware/verifyIdToken', () => ({
  verifyIdToken: (req: any, _res: any, next: any) => {
    req.uid = 'test-user-id';
    next();
  },
}));

describe('画像アップロード API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1.3.1-01 正常系：1～8 枚の valid PNG/JPEG を送信', () => {
    it('3枚の画像アップロードが成功する', async () => {
      // モック設定
      mockSanitizeFilename.mockImplementation((filename) => `sanitized_${filename}`);
      mockGenerateStoragePath.mockImplementation((path) => `${path.userId}/${path.stampId}/${path.type}/${path.filename}`);
      mockUploadFileToStorage.mockResolvedValue('https://storage.googleapis.com/bucket/file-url');
      
      const mockTransactionSet = jest.fn();
      
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({}),
      } as any);
      
      // トランザクションモックを修正：実際にコールバックを実行する
      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        await callback({
          set: mockTransactionSet,
          update: jest.fn(),
          get: jest.fn(),
          getAll: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        } as any);
      });

      // テスト用画像ファイルを作成
      const mockFiles = [
        {
          originalname: 'test1.png',
          buffer: Buffer.from('fake-image-1'),
          mimetype: 'image/png',
          size: 1024,
        },
        {
          originalname: 'test2.jpg',
          buffer: Buffer.from('fake-image-2'),
          mimetype: 'image/jpeg',
          size: 2048,
        },
        {
          originalname: 'test3.png',
          buffer: Buffer.from('fake-image-3'),
          mimetype: 'image/png',
          size: 1536,
        },
      ];

      const response = await request(app)
        .post('/images/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('images', mockFiles[0]!.buffer, mockFiles[0]!.originalname)
        .attach('images', mockFiles[1]!.buffer, mockFiles[1]!.originalname)
        .attach('images', mockFiles[2]!.buffer, mockFiles[2]!.originalname);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stampId');
      expect(response.body).toHaveProperty('uploadedCount', 3);
      expect(response.body).toHaveProperty('imageIds');
      expect(Array.isArray(response.body.imageIds)).toBe(true);
      expect(response.body.imageIds).toHaveLength(3);
    });

    it('8枚の画像アップロードが成功する', async () => {
      // モック設定
      mockSanitizeFilename.mockImplementation((filename) => `sanitized_${filename}`);
      mockGenerateStoragePath.mockImplementation((path) => `${path.userId}/${path.stampId}/${path.type}/${path.filename}`);
      mockUploadFileToStorage.mockResolvedValue('https://storage.googleapis.com/bucket/file-url');
      
      const mockTransactionSet = jest.fn();
      
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({}),
      } as any);
      
      // トランザクションモックを修正：実際にコールバックを実行する
      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        await callback({
          set: mockTransactionSet,
          update: jest.fn(),
          get: jest.fn(),
          getAll: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        } as any);
      });

      // 8枚のテスト用画像ファイルを作成
      const mockFiles = Array.from({ length: 8 }, (_, i) => ({
        originalname: `test${i + 1}.png`,
        buffer: Buffer.from(`fake-image-${i + 1}`),
        mimetype: 'image/png',
        size: 1024,
      }));

      let requestBuilder = request(app)
        .post('/images/upload')
        .set('Authorization', 'Bearer test-token');

      // 8枚の画像を添付
      mockFiles.forEach((file) => {
        requestBuilder = requestBuilder.attach('images', file.buffer, file.originalname);
      });

      const response = await requestBuilder;

      expect(response.status).toBe(200);
      expect(response.body.uploadedCount).toBe(8);
      expect(response.body.imageIds).toHaveLength(8);
    });
  });

  describe('1.3.1-02 Firestore にレコード追加', () => {
    it('images コレクションに type="original" が追加される', async () => {
      // モック設定
      mockSanitizeFilename.mockImplementation((filename) => `sanitized_${filename}`);
      mockGenerateStoragePath.mockImplementation((_path) => `storage-path`);
      mockUploadFileToStorage.mockResolvedValue('https://storage.googleapis.com/bucket/file-url');
      
      const mockTransactionSet = jest.fn();
      const mockTransactionUpdate = jest.fn();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({}),
      } as any);
      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        await callback({
          set: mockTransactionSet,
          update: mockTransactionUpdate,
          get: jest.fn(),
          getAll: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        } as any);
      });

      const mockFile = {
        originalname: 'test.png',
        buffer: Buffer.from('fake-image'),
        mimetype: 'image/png',
        size: 1024,
      };

      const response = await request(app)
        .post('/images/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('images', mockFile.buffer, mockFile.originalname);

      expect(response.status).toBe(200);
      
      // スタンプドキュメントが作成されることを確認
      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'test-user-id',
          status: 'generating',
          retryCount: 0,
        })
      );

      // 画像レコードが作成されることを確認
      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'original',
          sequence: 1,
        })
      );
    });
  });

  describe('1.3.1-03 ファイル数超過（9 枚） → HTTP 400 エラー', () => {
    it('9枚の画像をアップロードしようとすると400エラーを返す', async () => {
      // 9枚のテスト用画像ファイルを作成
      const mockFiles = Array.from({ length: 9 }, (_, i) => ({
        originalname: `test${i + 1}.png`,
        buffer: Buffer.from(`fake-image-${i + 1}`),
        mimetype: 'image/png',
        size: 1024,
      }));

      let requestBuilder = request(app)
        .post('/images/upload')
        .set('Authorization', 'Bearer test-token');

      // 9枚の画像を添付
      mockFiles.forEach((file) => {
        requestBuilder = requestBuilder.attach('images', file.buffer, file.originalname);
      });

      const response = await requestBuilder;

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Too many files');
    });
  });

  describe('1.3.1-04 各ファイルサイズ超過（>5MB） → HTTP 400 エラー', () => {
    it('5MBを超えるファイルをアップロードしようとすると400エラーを返す', async () => {
      const largeFileSize = 6 * 1024 * 1024; // 6MB
      const mockFile = {
        originalname: 'large.png',
        buffer: Buffer.alloc(largeFileSize), // 6MBのバッファを作成
        mimetype: 'image/png',
        size: largeFileSize,
      };

      const response = await request(app)
        .post('/images/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('images', mockFile.buffer, mockFile.originalname);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('File too large');
    });

    it('無効なMIMEタイプのファイルをアップロードしようとすると400エラーを返す', async () => {
      const mockFile = {
        originalname: 'test.gif',
        buffer: Buffer.from('fake-gif-data'),
        mimetype: 'image/gif', // 許可されていないMIMEタイプ
        size: 1024,
      };

      const response = await request(app)
        .post('/images/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('images', mockFile.buffer, mockFile.originalname);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid file type');
    });
  });
}); 