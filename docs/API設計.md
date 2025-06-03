```markdown
# API 設計書 - LINEスタンプ自動申請アプリ

すべての保護されたエンドポイントでは、HTTP ヘッダーに以下を付与してください:

```

Authorization: Bearer \<Firebase ID トークン>

````

エラー時のレスポンスは、必ず以下の形式で返却します。

```jsonc
// HTTP ステータスコードを合わせる (例: 400, 401, 404, 500)
{
  "error": {
    "code": 400,
    "message": "stampId が不正です。",
    "details": [
      { "field": "stampId", "issue": "必須パラメータです" }
    ]
  }
}
````

---

## 1. 認証・セッション関連

### GET /auth/session

* **説明**: 現在のログイン状態とユーザー情報を取得する

* **使用画面**: ログイン済み画面共通

* **対応機能**: セッション管理

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエスト**: なし

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "uid": "user_123",
      "email": "user@example.com",
      "displayName": "山田 太郎"
    }
  }
  ```

* **エラー例**:

  * 未認証 (401):

    ```json
    {
      "error": {
        "code": 401,
        "message": "ID トークンが無効です。",
        "details": []
      }
    }
    ```

---

## 2. トークン残数・購入関連

### GET /tokens/balance

* **説明**: 現在のトークン残数を取得する

* **使用画面**: ダッシュボード、トークン購入画面、画像生成画面

* **対応機能**: トークン残数表示

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエスト**: なし

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "balance": 120
    }
  }
  ```

* **エラー例**:

  * 401 Unauthorized:

    ```json
    {
      "error": {
        "code": 401,
        "message": "認証に失敗しました。",
        "details": []
      }
    }
    ```

---

### POST /tokens/checkout-session

* **説明**: Stripe の購入セッションを作成し、Checkout を開始する

* **使用画面**: トークン購入画面

* **対応機能**: Stripe 決済処理

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエストヘッダー**:

  ```
  Content-Type: application/json
  ```

* **リクエストボディ例**:

  ```json
  {
    "tokenPackage": "40tokens"
  }
  ```

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "sessionId": "cs_test_a1b2c3d4"
    }
  }
  ```

* **エラー例**:

  * 400 Bad Request:

    ```json
    {
      "error": {
        "code": 400,
        "message": "tokenPackage が無効です。",
        "details": []
      }
    }
    ```

---

### POST /webhook/stripe

* **説明**: Stripe Webhook を受け取り、購入完了後にトークンを付与する

* **使用画面**: バックエンド処理のみ

* **対応機能**: 購入完了後のトークン付与処理

* **認可**: 署名検証による認証

  1. リクエストヘッダー `Stripe-Signature` を取得
  2. 環境変数 `STRIPE_WEBHOOK_SECRET` を使って検証

* **リクエスト**: 生の JSON ペイロードを `express.raw({ type: "application/json" })` で受け取る

* **リクエスト例 (生データ)**:

  ```json
  {
    "id": "evt_1A2b3C4d",
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "client_reference_id": "user_123",
        "metadata": { "tokenPackage": "40tokens" }
      }
    }
  }
  ```

* **挙動**:

  1. `stripe.webhooks.constructEvent(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET)` で署名検証
  2. `event.type === "checkout.session.completed"` の場合、`session.data.object.client_reference_id` を `userId` として取得
  3. `session.data.object.metadata.tokenPackage` を元に付与トークン数を算出
  4. Firestore トランザクションで:

     * `users/{userId}.tokenBalance` をインクリメント
     * `token_transactions` コレクションにレコードを追加

* **レスポンス例**:

  * 署名検証成功 (200 OK):

    ```json
    {
      "data": {
        "received": true
      }
    }
    ```

  * 署名検証失敗 (400 Bad Request):

    ```json
    {
      "error": {
        "code": 400,
        "message": "Webhook 署名検証に失敗しました。",
        "details": []
      }
    }
    ```

---

### POST /tokens/consume

* **説明**: スタンプ生成時にトークンを消費する

* **使用画面**: 生成中画面

* **対応機能**: トークン消費処理

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエストヘッダー**:

  ```
  Content-Type: application/json
  ```

* **リクエストボディ例**:

  ```json
  {
    "stampId": "stamp_789",
    "amount": 40
  }
  ```

* **挙動**:

  1. Firestore トランザクション内で:

     * `token_consumptions` コレクションにレコード追加
     * `stamps/{stampId}.consumedTokens` を `FieldValue.increment(amount)` でインクリメント
     * `users/{uid}.tokenBalance` を `FieldValue.increment(-amount)` でデクリメント

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "success": true,
      "balance": 80
    }
  }
  ```

* **エラー例**:

  * 400 Bad Request:

    ```json
    {
      "error": {
        "code": 400,
        "message": "amount が現在の残高を超えています。",
        "details": []
      }
    }
    ```

---

## 3. 画像アップロード・取得関連

### POST /images/upload

* **説明**: スタンプ画像をサーバーにアップロード＆一時保存する

* **使用画面**: 画像アップロード画面

* **対応機能**: 画像アップロード / 一時保存

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエストヘッダー**:

  ```
  Content-Type: multipart/form-data
  ```

* **リクエスト例**:

  * `stampId`: `stamp_789`
  * `images`: ファイル配列 (最大 8 枚, 各 5MB 以下, PNG/JPEG)

* **バリデーション**:

  * ファイル数: 1～8 枚
  * 各ファイルサイズ: ≤ 5MB
  * 合計サイズ: ≤ 50MB
  * ファイル形式: PNG / JPEG のみ

* **挙動**:

  1. Firestore `stamps/{stampId}` ドキュメントが存在するか確認
  2. 画像を Firebase Storage にアップロード

     * 保存パス例: `users/{uid}/stamps/{stampId}/original/{filename}`
  3. Firestore `images` コレクションにレコード追加

     * `stampId`, `type = "original"`, `url`, `sequence`, `createdAt`

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "stampId": "stamp_789",
      "uploadedCount": 8
    }
  }
  ```

* **エラー例**:

  * 400 Bad Request (検証エラー):

    ```json
    {
      "error": {
        "code": 400,
        "message": "ファイル形式は PNG / JPEG のみ、1～8 枚、合計 50MB 以下でアップロードしてください。",
        "details": []
      }
    }
    ```

  * 404 Not Found (`stampId` が存在しない場合):

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された stampId が見つかりません。",
        "details": []
      }
    }
    ```

---

### GET /images/list?stampId={stampId}

* **説明**: アップロード済み画像の一覧 URL を取得する

* **使用画面**: 画像アップロード画面、プレビュー画面

* **対応機能**: 一時保存画像取得 / プレビュー表示

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **クエリパラメータ**:

  * `stampId`: string（必須）

* **挙動**:

  1. Firestore で `images` コレクションから `stampId` に紐づくドキュメントを取得
  2. `type = "original"` のものを `sequence` 順に取得し、URL 配列として返却

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "images": [
        "https://.../stamp_789_01.png",
        "https://.../stamp_789_02.png",
        "...",
        "https://.../stamp_789_08.png"
      ]
    }
  }
  ```

* **エラー例**:

  * 400 Bad Request (`stampId` が未指定):

    ```json
    {
      "error": {
        "code": 400,
        "message": "stampId は必須です。",
        "details": []
      }
    }
    ```

  * 404 Not Found (`stampId` が存在しない場合):

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された stampId が見つかりません。",
        "details": []
      }
    }
    ```

---

## 4. スタンプ生成・プレビュー関連

### POST /stamps/generate

* **説明**: アップロード画像を整形してスタンプを生成ジョブに登録する

* **使用画面**: 生成中画面

* **対応機能**: 画像整形 / ジョブ登録

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエストヘッダー**:

  ```
  Content-Type: application/json
  ```

* **リクエストボディ例**:

  ```json
  {
    "stampId": "stamp_789"
  }
  ```

* **挙動**:

  1. Firestore で `stamps/{stampId}` が存在し、かつ `status = "pending_upload"` かを確認
  2. `stamps/{stampId}.status = "generating"` に更新
  3. sharp / Cloud Function などで画像整形を実行し、

     * 加工後画像を Firebase Storage に保存 (例: `processed/{filename}`)、
     * Firestore `images` コレクションに `type = "processed"` でレコード追加
     * 完了後 `stamps/{stampId}.status = "generated"` に更新

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "stampId": "stamp_789",
      "status": "generating"
    }
  }
  ```

* **エラー例**:

  * 400 Bad Request (`stampId` 状態不正):

    ```json
    {
      "error": {
        "code": 400,
        "message": "現在のステータスでは生成できません。",
        "details": []
      }
    }
    ```

  * 404 Not Found (`stampId` が存在しない場合):

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された stampId が見つかりません。",
        "details": []
      }
    }
    ```

---

### GET /stamps/{stampId}/status

* **説明**: 指定スタンプ 1 件のステータスを取得する

* **使用画面**: 生成中画面、プレビュー画面、申請進捗画面、エラー画面

* **対応機能**: ステータスチェック

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **パスパラメータ**:

  * `stampId`: string（必須）

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "stampId": "stamp_789",
      "status": "generated",
      "retryCount": 0
    }
  }
  ```

* **エラー例**:

  * 404 Not Found:

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された stampId が見つかりません。",
        "details": []
      }
    }
    ```

---

### GET /stamps/status?userId={userId}

* **説明**: 指定ユーザーのすべてのスタンプステータスを一括取得する

* **使用画面**: アプリ起動時の中断再開、マイページ

* **対応機能**: 中断再開フロー

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **クエリパラメータ**:

  * `userId`: string（必須）

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": [
      { "stampId": "stamp_123", "status": "pending_upload", "retryCount": 0 },
      { "stampId": "stamp_456", "status": "submitting",      "retryCount": 1 },
      { "stampId": "stamp_789", "status": "generated",       "retryCount": 0 }
    ]
  }
  ```

* **エラー例**:

  * 400 Bad Request (`userId` が未指定):

    ```json
    {
      "error": {
        "code": 400,
        "message": "userId は必須です。",
        "details": []
      }
    }
    ```

  * 404 Not Found (`userId` のユーザーが存在しない場合):

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された userId が見つかりません。",
        "details": []
      }
    }
    ```

---

### GET /stamps/{stampId}/preview

* **説明**: プレビュー用のスタンプ画像 URL を取得する

* **使用画面**: プレビュー画面

* **対応機能**: プレビュー表示

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **パスパラメータ**:

  * `stampId`: string（必須）

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "images": [
        "https://.../stamp_789_01_processed.png",
        "...",
        "https://.../stamp_789_08_processed.png"
      ],
      "mainImage": "https://.../stamp_789_main.png"
    }
  }
  ```

* **エラー例**:

  * 404 Not Found (`stampId` が存在しない場合):

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された stampId が見つかりません。",
        "details": []
      }
    }
    ```

---

## 5. スタンプ申請関連

### POST /stamps/submit

* **説明**: LINE 申請処理を開始し、Puppeteer ジョブを起動する

* **使用画面**: プレビュー画面 → 申請進捗画面

* **対応機能**: LINE 申請自動化

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエストヘッダー**:

  ```
  Content-Type: application/json
  ```

* **リクエストボディ例**:

  ```json
  {
    "stampId": "stamp_789",
    "title": "My Cute Stamps",
    "description": "かわいい動物スタンプセット",
    "category": "Animals",
    "tags": ["cat", "dog", "cute"]
  }
  ```

* **バリデーション**:

  * `title`: 必須、文字列、最大 40 文字
  * `description`: 任意、文字列、最大 200 文字
  * `category`: 必須、列挙型（例: `"Animals"`, `"Daily"`, `"Funny"` など）
  * `tags`: 任意、文字列配列、最大 5 要素、各要素最大 20 文字

* **挙動**:

  1. Firestore で `stamps/{stampId}` の存在とステータスを確認

     * 状態は `"generated"` のみ許可
  2. `stamps/{stampId}.status = "submitting"` に更新
  3. Puppeteer ジョブを起動して自動申請を実行

     * セッション情報は `line_sessions/{userId}` 参照し、Cookie をセット
  4. Puppeteer 完了時に、正常なら `status = "submitted"`、失敗なら `status = "failed"`、セッション切れなら `status = "session_expired"` に更新
  5. `submission_attempts` コレクションに試行結果を記録

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "stampId": "stamp_789",
      "status": "submitting"
    }
  }
  ```

* **エラー例**:

  * 400 Bad Request (バリデーションエラー):

    ```json
    {
      "error": {
        "code": 400,
        "message": "title は必須、かつ最大 40 文字です。",
        "details": [
          { "field": "title", "issue": "必須パラメータ" }
        ]
      }
    }
    ```

  * 404 Not Found (`stampId` が存在しない場合):

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された stampId が見つかりません。",
        "details": []
      }
    }
    ```

  * 409 Conflict (ステータス不正):

    ```json
    {
      "error": {
        "code": 409,
        "message": "現在のステータスでは申請できません。",
        "details": []
      }
    }
    ```

---

### POST /stamps/retry

* **説明**: 申請失敗後の再申請処理をトリガーする

* **使用画面**: エラー画面

* **対応機能**: 再申請機能

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエストヘッダー**:

  ```
  Content-Type: application/json
  ```

* **リクエストボディ例**:

  ```json
  {
    "stampId": "stamp_789"
  }
  ```

* **挙動**:

  1. Firestore で `stamps/{stampId}` の存在を確認
  2. 現在のステータスが `"failed"` のみ許可
  3. `submission_attempts` コレクションで最新の `attemptNo` を取得し、`attemptNo + 1` で新規レコード作成
  4. `stamps/{stampId}.retryCount` を `FieldValue.increment(1)` で更新
  5. 再度 `stamps/{stampId}.status = "submitting"` に更新し、Puppeteer ジョブを再起動

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "stampId": "stamp_789",
      "status": "submitting",
      "retryCount": 1
    }
  }
  ```

* **エラー例**:

  * 404 Not Found:

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された stampId が見つかりません。",
        "details": []
      }
    }
    ```

  * 409 Conflict (ステータス不正):

    ```json
    {
      "error": {
        "code": 409,
        "message": "現在のステータスでは再申請できません。",
        "details": []
      }
    }
    ```

---

## 6. プリセット関連

### GET /presets/list

* **説明**: 生成可能なプリセット一覧を取得する（ID / ラベル / サムネイル URL）

* **使用画面**: プリセット選択画面

* **対応機能**: プリセット取得

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエスト**: なし

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "presets": [
        {
          "id": "cat_ears",
          "label": "ネコミミ",
          "thumbnailUrl": "https://.../cat_ears.png"
        },
        {
          "id": "handdrawn",
          "label": "手書き風",
          "thumbnailUrl": "https://.../handdrawn.png"
        }
      ]
    }
  }
  ```

* **エラー例**:

  * 401 Unauthorized:

    ```json
    {
      "error": {
        "code": 401,
        "message": "認証に失敗しました。",
        "details": []
      }
    }
    ```

---

### POST /stamps/set-preset

* **説明**: 指定スタンプにプリセットを設定し、生成へ移行する

* **使用画面**: プリセット選択画面

* **対応機能**: プリセット設定

* **認可**: `Authorization: Bearer <ID トークン>`（必須）

* **リクエストヘッダー**:

  ```
  Content-Type: application/json
  ```

* **リクエストボディ例**:

  ```json
  {
    "stampId": "stamp_789",
    "presetId": "cat_ears"
  }
  ```

* **挙動**:

  1. Firestore で `stamps/{stampId}` の存在を確認
  2. `presets/{presetId}` が存在することを確認
  3. `stamps/{stampId}.presetId = presetId`、`presetConfig = presets/{presetId}.config` に更新
  4. `stamps/{stampId}.status = "submitting"` に更新し、Puppeteer 申請を直接トリガー

* **レスポンス例 (200 OK)**:

  ```json
  {
    "data": {
      "stampId": "stamp_789",
      "presetId": "cat_ears",
      "presetConfig": {
        "borderColor": "#FF0000",
        "backgroundColor": "#FFFFFF",
        "overlayShape": "ears",
        "overlayOpacity": 0.8,
        "additionalFilters": []
      },
      "status": "submitting"
    }
  }
  ```

* **エラー例**:

  * 400 Bad Request (バリデーションエラー):

    ```json
    {
      "error": {
        "code": 400,
        "message": "presetId が無効です。",
        "details": []
      }
    }
    ```

  * 404 Not Found (`stampId` または `presetId` が存在しない場合):

    ```json
    {
      "error": {
        "code": 404,
        "message": "指定された ID が見つかりません。",
        "details": []
      }
    }
    ```

---

## 7. その他

### GET /health

* **説明**: サービス正常性確認用エンドポイント

* **使用画面**: なし（内部チェック）

* **対応機能**: ヘルスチェック

* **認可**: なし

* **リクエスト**: なし

* **レスポンス例 (200 OK)**:

  ```json
  {
    "status": "ok"
  }
  ```

* **エラー例**: なし

---

```
```
