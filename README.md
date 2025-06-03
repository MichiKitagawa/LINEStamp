# LINEスタンプ自動生成・申請システム

## 概要
LINEスタンプの自動生成から申請まで一括で行うWebアプリケーションシステムです。
ユーザーがアップロードした画像から、AIを活用してLINEスタンプを生成し、自動的にLINE Creators Marketに申請を行います。

## 機能
- Google認証による会員登録・ログイン
- トークン制課金システム（Stripe決済）
- 画像アップロード・プリセット選択
- AIによるスタンプ生成
- LINE Creators Marketへの自動申請
- 申請状況の確認・エラー復旧機能

## 技術スタック
- **フロントエンド**: Next.js, React, TypeScript, Tailwind CSS
- **バックエンド**: Express.js, TypeScript, Firebase Admin SDK
- **データベース**: Firebase Firestore
- **認証**: Firebase Authentication
- **決済**: Stripe
- **ストレージ**: Firebase Cloud Storage
- **自動化**: Puppeteer
- **デプロイ**: Google Cloud Run

## 開発環境セットアップ

### 前提条件
- Node.js 18.x以上
- npm または yarn
- Firebase CLI
- Git

### 環境構築手順

1. リポジトリのクローン
\`\`\`bash
git clone https://github.com/MichiKitagawa/LINEStamp.git
cd LINEStamp
\`\`\`

2. 依存関係のインストール
\`\`\`bash
# バックエンド
cd backend
npm install

# フロントエンド
cd ../frontend
npm install
\`\`\`

3. 環境変数の設定
\`\`\`bash
# バックエンド/.env
cp backend/.env.example backend/.env

# フロントエンド/.env.local
cp frontend/.env.example frontend/.env.local
\`\`\`

4. Firebase プロジェクトのセットアップ
\`\`\`bash
firebase login
firebase init
\`\`\`

5. Firestore エミュレータの起動
\`\`\`bash
firebase emulators:start
\`\`\`

6. 開発サーバーの起動
\`\`\`bash
# バックエンド（ポート3001）
cd backend
npm run dev

# フロントエンド（ポート3000）
cd frontend
npm run dev
\`\`\`

## テスト実行

### ユニットテスト
\`\`\`bash
# バックエンド
cd backend
npm test

# フロントエンド
cd frontend
npm test
\`\`\`

### E2Eテスト
\`\`\`bash
npm run test:e2e
\`\`\`

## デプロイ

### ステージング環境
\`\`\`bash
npm run deploy:staging
\`\`\`

### 本番環境
\`\`\`bash
npm run deploy:prod
\`\`\`

## 開発フロー
1. 機能ブランチを作成
2. 開発・テスト実装
3. Pull Request作成
4. コードレビュー
5. マージ
6. 自動デプロイ

## ライセンス
MIT License

## 作者
MichiKitagawa 