import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import genomicLabRoutes from './routes/genomicLabRoutes.js';
import genomicServiceRoutes from './routes/genomicServiceRoutes.js';
import histoServiceRoutes from './routes/histoServiceRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { startHinaiScheduler } from './services/hinaiScheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7012;
const BASE_PATH = process.env.BASE_PATH || '/lab-api';
const API_BASE_PATH = `${BASE_PATH}/api`;

const allowedOrigins = process.env.FRONT_END_URL?.split(',').map(o => o.trim()) || ['*'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Routes
app.use(`${API_BASE_PATH}/auth`, authRoutes);
app.use('/api/auth', authRoutes);
app.use(`${API_BASE_PATH}/genomiclabregister`, genomicLabRoutes);
app.use('/api/genomiclabregister', genomicLabRoutes);
app.use(`${API_BASE_PATH}/genomiclab`, genomicLabRoutes);
app.use('/api/genomiclab', genomicLabRoutes);
app.use(`${API_BASE_PATH}/genomic-lab`, genomicLabRoutes);
app.use('/api/genomic-lab', genomicLabRoutes);

app.use(`${API_BASE_PATH}/genomic-services`, genomicServiceRoutes);
app.use('/api/genomic-services', genomicServiceRoutes);
app.use(`${API_BASE_PATH}/histo-services`, histoServiceRoutes);
app.use('/api/histo-services', histoServiceRoutes);
app.use(`${API_BASE_PATH}/permissions`, permissionRoutes);
app.use('/api/permissions', permissionRoutes);

// Health Check
app.get(['/api/health', `${API_BASE_PATH}/health`], (req, res) => {
  res.json({ success: true, message: 'Zydus Lab API is running 🧪' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🧪 Zydus Lab API running at http://localhost:${PORT}`);
  startHinaiScheduler();
});
