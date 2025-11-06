import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import menuRoutes from './routes/menu.routes.js';
import dataRoutes from './routes/data.routes.js';
import aiRoutes from './routes/ai.routes.js';
import schemaRoutes from './routes/schema.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import dataStore from './services/dataStore.js';

// ES Module에서 __dirname 사용하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드 (프로젝트 루트의 .env 파일)
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (업로드된 파일)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI-ERP Server is running',
    ai: process.env.DEFAULT_AI || 'gemini',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/menus', menuRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/schema', schemaRoutes);

// Error Handler (마지막에 위치)
app.use(errorHandler);

// 서버 시작
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 AI-ERP Server Started!              ║
╠═══════════════════════════════════════════╣
║   Port: ${PORT}                            ║
║   AI: ${process.env.DEFAULT_AI || 'gemini'}                              ║
║   Environment: ${process.env.NODE_ENV || 'development'}            ║
║   API: http://localhost:${PORT}/api          ║
╚═══════════════════════════════════════════╝
  `);
  
  // 데이터 저장소 초기화
  dataStore.load().then(() => {
    console.log('✅ Data store loaded successfully');
  }).catch(err => {
    console.error('⚠️  Failed to load data store:', err.message);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await dataStore.persist();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  await dataStore.persist();
  process.exit(0);
});

