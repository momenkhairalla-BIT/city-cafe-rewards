import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import studentsRoutes from './routes/students.js';
import membersRoutes from './routes/members.js';
import scanRoutes from './routes/scan.js';
import offersRoutes from './routes/offers.js';
import ordersRoutes from './routes/orders.js';
import analyticsRoutes from './routes/analytics.js';
import { requireAuth, requireRole } from './middleware/auth.js';

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required when NODE_ENV=production');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prototypeRoot = path.resolve(__dirname, '../../..');

app.set('trust proxy', 1);

const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(s => s.trim()) } : { origin: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/js', express.static(path.join(prototypeRoot, 'js')));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'city-cafe-api', database: 'connected', auth: 'jwt' });
  } catch {
    res.status(503).json({ status: 'error', service: 'city-cafe-api', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);

const api = express.Router();
api.use(requireAuth);

api.use('/menu', menuRoutes);
api.use('/students', studentsRoutes);
api.use('/members', membersRoutes);
api.use('/scan', requireRole('staff', 'admin'), scanRoutes);
api.use('/offers', offersRoutes);
api.use('/orders', ordersRoutes);
api.use('/analytics', requireRole('admin'), analyticsRoutes);

app.use('/api', api);

app.get('/', (_req, res) => {
  res.sendFile(path.join(prototypeRoot, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`City Café API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Local: http://localhost:${PORT}`);
  }
});
