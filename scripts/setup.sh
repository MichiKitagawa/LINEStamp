#!/bin/bash

# LINEスタンプ自動生成システム - 開発環境セットアップスクリプト

set -e

echo "🚀 LINEスタンプ自動生成システムの開発環境をセットアップします..."

# Node.jsのバージョン確認
echo "📋 Node.jsのバージョンを確認中..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません。Node.js 18.x以上をインストールしてください。"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js 18.x以上が必要です。現在のバージョン: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js $NODE_VERSION を確認しました"

# Firebase CLIの確認とインストール
echo "📋 Firebase CLIを確認中..."
if ! command -v firebase &> /dev/null; then
    echo "📦 Firebase CLIをインストール中..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLIが既にインストールされています"
fi

# ルートディレクトリの依存関係インストール
echo "📦 ルートディレクトリの依存関係をインストール中..."
npm install

# バックエンドの依存関係インストール
echo "📦 バックエンドの依存関係をインストール中..."
if [ ! -d "backend" ]; then
    echo "❌ backendディレクトリが見つかりません"
    exit 1
fi
cd backend && npm install && cd ..

# フロントエンドの依存関係インストール
echo "📦 フロントエンドの依存関係をインストール中..."
if [ ! -d "frontend" ]; then
    echo "❌ frontendディレクトリが見つかりません"
    exit 1
fi
cd frontend && npm install && cd ..

# E2Eテストの依存関係インストール
echo "📦 E2Eテストの依存関係をインストール中..."
if [ ! -d "e2e" ]; then
    echo "❌ e2eディレクトリが見つかりません"
    exit 1
fi
cd e2e && npm install && cd ..

# 環境変数ファイルのコピー
echo "📝 環境変数ファイルを設定中..."
if [ ! -f ".env" ]; then
    cp env.example .env
    echo "✅ .envファイルを作成しました。必要な値を設定してください。"
fi

if [ ! -f "backend/.env" ]; then
    cp env.example backend/.env
    echo "✅ backend/.envファイルを作成しました。"
fi

if [ ! -f "frontend/.env.local" ]; then
    cp env.example frontend/.env.local
    echo "✅ frontend/.env.localファイルを作成しました。"
fi

# Firebaseプロジェクトの初期化確認
echo "🔥 Firebaseプロジェクトの設定を確認中..."
if [ ! -f ".firebaserc" ]; then
    echo "⚠️  Firebaseプロジェクトが設定されていません。"
    echo "   以下のコマンドでFirebaseプロジェクトを設定してください："
    echo "   firebase login"
    echo "   firebase use --add"
fi

echo ""
echo "🎉 セットアップが完了しました！"
echo ""
echo "📋 次のステップ:"
echo "1. .env ファイルの環境変数を設定"
echo "2. Firebaseプロジェクトの設定 (未設定の場合)"
echo "3. 開発サーバーの起動: npm run dev"
echo "4. Firestoreエミュレータの起動: npm run emulator"
echo ""
echo "🔗 参考リンク:"
echo "   - README.md: プロジェクトの詳細情報"
echo "   - docs/: 技術仕様書とドキュメント"
echo "" 