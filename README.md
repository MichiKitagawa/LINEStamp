# LINEスタンプ自動生成・申請システム

## 概要
LINEスタンプの自動生成から申請まで一括で行うWebアプリケーションシステムです。
ユーザーがアップロードした画像から、AIを活用してLINEスタンプを生成し、自動的にLINE Creators Marketに申請を行います。

## 機能
- Google認証による会員登録・ログイン ✅**実装済み**
- トークン制課金システム（Stripe決済） ✅**実装済み**
- 画像アップロード・プリセット選択 ✅**実装済み**
- AIによるスタンプ生成 🚧**モック実装**
- LINE Creators Marketへの自動申請 🚧**モック実装**
- 申請状況の確認・エラー復旧機能 ✅**実装済み**

## 技術スタック
- **フロントエンド**: Next.js, React, TypeScript, Tailwind CSS
- **バックエンド**: Express.js, TypeScript, Firebase Admin SDK
- **データベース**: Firebase Firestore ✅**実サービス連携済み**
- **認証**: Firebase Authentication ✅**実サービス連携済み**
- **決済**: Stripe ✅**実サービス連携済み**
- **ストレージ**: Firebase Cloud Storage ✅**実サービス連携済み**
- **自動化**: Puppeteer 🚧**モック実装**
- **デプロイ**: Google Cloud Run

## 実装状況

### ✅ 実装完了・実サービス連携済み
- **Firebase認証**: Google認証でのログイン・ログアウト
- **Firestore**: ユーザー情報、トークン残高、スタンプデータの管理
- **Firebase Storage**: 画像ファイルのアップロード・管理
- **Stripe**: トークン購入、Webhook処理
- **認証ミドルウェア**: IDトークン検証
- **画像アップロード**: ドラッグ&ドロップ対応のUIとAPI
- **トークン管理**: 残高確認、消費処理
- **エラーハンドリング**: 適切なエラー表示と復旧機能

### 🚧 モック実装（実サービス待ち）
- **画像生成API**: 現在はダミー画像を生成（OpenAI DALL-E等の実装待ち）
- **LINE申請処理**: 現在はモック処理（実際のPuppeteer自動申請実装待ち）

## 開発環境セットアップ

### 前提条件
- Node.js 18.x以上
- npm または yarn
- Firebase CLI
- Git
- **Firebase プロジェクト**（要作成）
- **Stripe アカウント**（要作成）

### 1. リポジトリのクローン
```bash
git clone https://github.com/MichiKitagawa/LINEStamp.git
cd LINEStamp
```

### 2. 依存関係のインストール
```bash
# 自動セットアップスクリプトの実行
chmod +x scripts/setup.sh
./scripts/setup.sh
```

または手動で：
```bash
# バックエンド
cd backend && npm install

# フロントエンド
cd ../frontend && npm install

# E2Eテスト
cd ../e2e && npm install

# 結合テスト
cd ../tests && npm install
```

### 3. Firebase プロジェクトのセットアップ

#### 3.1 Firebase プロジェクト作成
1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. Authentication > Sign-in method でGoogle認証を有効化
4. Firestore Database を作成（テストモードで開始）
5. Storage を有効化

#### 3.2 サービスアカウントキーの生成
1. プロジェクト設定 > サービスアカウント
2. 「新しい秘密鍵の生成」をクリック
3. JSONファイルをダウンロード
4. ファイル内容から以下の値を取得：
   - `project_id`
   - `private_key`
   - `client_email`

### 4. Stripe アカウントのセットアップ

#### 4.1 Stripe ダッシュボードで設定
1. [Stripe Dashboard](https://dashboard.stripe.com/) にアクセス
2. 開発者 > APIキーから以下を取得：
   - 公開可能キー (pk_test_...)
   - シークレットキー (sk_test_...)
3. 開発者 > Webhook で新しいエンドポイントを作成：
   - URL: `http://localhost:3001/tokens/webhook/stripe`
   - イベント: `checkout.session.completed`
   - Webhook署名シークレットを取得

#### 4.2 トークンパッケージの価格IDを作成
1. 商品 > 商品カタログで新しい商品を作成：
   - **50トークンパック**: 5000円
   - **200トークンパック**: 2,000円  
   - **1000トークンパック**: 9,800円
2. 各商品に対して価格を設定し、価格ID（price_xxx）をコピー
3. 価格IDを環境変数に設定：
   - `STRIPE_PRICE_50_TOKENS=price_your_50_tokens_price_id`
   - `STRIPE_PRICE_200_TOKENS=price_your_200_tokens_price_id`
   - `STRIPE_PRICE_1000_TOKENS=price_your_1000_tokens_price_id`

**注意**: 価格IDが設定されていない場合は自動的に`price_data`方式にフォールバックします。
### 5. 環境変数の設定

#### 5.1 バックエンド (`backend/.env`)
```bash
# Firebase設定
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Stripe設定
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs（推奨：事前に作成）
STRIPE_PRICE_50_TOKENS=price_your_50_tokens_price_id
STRIPE_PRICE200_TOKENS=price_your_200_tokens_price_id
STRIPE_PRICE_1000_TOKENS=price_your_1000_tokens_price_id

# サーバー設定
PORT=3001
NODE_ENV=development
```

#### 5.2 フロントエンド (`frontend/.env.local`)
```bash
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id

# API設定
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# Stripe設定
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### 6. 開発サーバーの起動

#### 6.1 バックエンド（ポート3001）
```bash
cd backend
npm run dev
```

#### 6.2 フロントエンド（ポート3000）
```bash
cd frontend
npm run dev
```

### 7. 動作確認

1. http://localhost:3000 にアクセス
2. Googleアカウントでログイン
3. トークン購入機能をテスト（テストカードを使用）
4. 画像アップロード機能をテスト

## テスト実行

### ユニットテスト
```bash
# バックエンド
cd backend && npm test

# フロントエンド
cd frontend && npm test
```

### 結合テスト
```bash
# Firestoreエミュレータを起動
firebase emulators:start --only firestore

# 結合テストを実行
cd tests && npm test
```

### E2Eテスト
```bash
# 開発サーバーを起動後
cd e2e && npx playwright test
```

## トラブルシューティング

### Firebase接続エラー
- 環境変数が正しく設定されているか確認
- プロジェクトIDとサービスアカウントキーが一致しているか確認
- Firebase Rulesでアクセス権限が適切に設定されているか確認

### Stripe決済エラー
- Webhookエンドポイントが正しく設定されているか確認
- テスト環境でテストカード番号を使用しているか確認
- Stripe設定でWebhookイベントが適切に選択されているか確認

### 認証エラー
- Firebaseコンソールで認証方法が有効化されているか確認
- 承認済みドメインにlocalhost:3000が追加されているか確認

## 🔗 参考リンク
- [Firebase Console](https://console.firebase.google.com/)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- [プロジェクト技術仕様書](./docs/技術仕様書.md)
- [API設計書](./docs/API設計.md)
- [テスト仕様書](./docs/テスト.md)

## ライセンス
MIT 