# Firebase サービスアカウントキー再生成手順

## 問題の概要

現在の状況：
- フロントエンドとバックエンドで同じプロジェクトID（`line-stamp-gen-dev`）を使用
- プロジェクトID、iss（issuer）、aud（audience）は全て一致
- しかし、Firebase ID token の署名検証が失敗している

## 解決手順

### 1. Firebase Console でサービスアカウント新規作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. `line-stamp-gen-dev` プロジェクトを選択
3. 左側メニュー「プロジェクトの設定」（歯車アイコン）→「サービス アカウント」タブ
4. 「新しい秘密鍵の生成」ボタンをクリック
5. JSONファイルをダウンロード

### 2. 新しいサービスアカウントキーの確認

ダウンロードしたJSONファイルを確認：
```json
{
  "type": "service_account",
  "project_id": "line-stamp-gen-dev",
  "private_key_id": "新しいキーID",
  "private_key": "-----BEGIN PRIVATE KEY-----\n新しいキー\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@line-stamp-gen-dev.iam.gserviceaccount.com",
  "client_id": "xxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### 3. 環境変数の更新

`backend/.env` ファイルを更新：

```env
# 新しいサービスアカウント情報
FIREBASE_PROJECT_ID="line-stamp-gen-dev"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@line-stamp-gen-dev.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n新しいキー\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET="line-stamp-gen-dev.firebasestorage.app"
```

### 4. 特殊文字の確認

新しいprivate_keyに以下の文字が含まれていないか確認：
- `%`（パーセント）
- `/`（スラッシュ）  
- `+`（プラス）

これらの文字が含まれている場合は、再度新しいキーを生成してください。

### 5. 改行文字の適切な設定

`.env`ファイルでは改行文字を`\\n`として設定：
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC...\\n-----END PRIVATE KEY-----\\n"
```

### 6. バックエンドサーバーの再起動

```bash
cd backend
npm run dev
```

### 7. 検証

バックエンドコンソールで以下のログが表示されることを確認：
- ✅ Firebase Admin SDK initialized successfully
- ✅ Private key BASE64 format valid
- 📏 Private key lines count: 適切な行数
- ⚠️ Special characters found: 無し

### 8. フロントエンドでの再テスト

ブラウザでダッシュボードにアクセスし、認証が成功することを確認。

## トラブルシューティング

### 権限エラーが発生する場合
1. Firebase Console で「IAM と管理」を確認
2. サービスアカウントに「Firebase Admin SDK 管理者サービス エージェント」ロールが付与されているか確認

### まだ署名エラーが発生する場合
1. システム時刻を確認：
   ```bash
   powershell -Command "Get-Date"
   ```
2. 時刻がUTCから大きくずれている場合は同期：
   ```bash
   w32tm /resync
   ```

### 最終手段
1. 完全に新しいFirebaseプロジェクトを作成
2. フロントエンドとバックエンドの設定を新プロジェクトに移行 