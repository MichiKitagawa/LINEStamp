import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from '@/routes/auth';
import tokensRoutes from '@/routes/tokens';
import imagesRoutes from '@/routes/images';
import presetsRoutes from '@/routes/presets';
import stampsRoutes from '@/routes/stamps';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

// Security middleware
app.use(helmet());

// Rate limiting - 開発環境では緩和
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env['NODE_ENV'] === 'production' ? 100 : 1000, // 開発時は1000に増加
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// CORS configuration - DEVELOPMENT ONLY
if (process.env['NODE_ENV'] !== 'production') {
  // 開発環境用：より寛容なCORS設定
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // プリフライトリクエストの処理
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    
    next();
  });
} else {
  // 本番環境用：セキュアなCORS設定
app.use(cors({
    origin: ['https://your-frontend-domain.com'],
  credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 200
}));
}

// Stripe webhook endpoint needs raw body - must be before json middleware
app.use('/tokens/webhook/stripe', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] ?? 'development',
  });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({
    message: 'LINEスタンプ自動生成システム API',
    version: '1.0.0',
    status: 'running',
  });
});

// Route handlers
app.use('/auth', authRoutes);
app.use('/tokens', tokensRoutes);
app.use('/images', imagesRoutes);
app.use('/presets', presetsRoutes);
app.use('/stamps', stampsRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env['NODE_ENV'] === 'production' ? 'Something went wrong' : err.message,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

export default app; 