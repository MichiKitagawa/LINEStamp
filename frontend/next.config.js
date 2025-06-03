/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  
  // TypeScript設定
  typescript: {
    // プロダクションビルド時に型チェックを実行
    tsconfigPath: './tsconfig.json',
  },

  // ESLint設定
  eslint: {
    dirs: ['src'],
  },

  // 画像最適化設定
  images: {
    domains: ['firebasestorage.googleapis.com'],
    formats: ['image/webp', 'image/avif'],
  },

  // 環境変数設定
  env: {
    CUSTOM_KEY: 'my-value',
  },

  // 静的エクスポート設定（必要時）
  trailingSlash: true,
  output: process.env.BUILD_STANDALONE === 'true' ? 'export' : undefined,

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Webpack設定カスタマイズ
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // カスタムWebpack設定がある場合はここに追加
    return config;
  },
};

module.exports = nextConfig; 