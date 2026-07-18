const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

// Import modular routers & engines
const authRoutes = require('./routes/authRoutes');
const problemRoutes = require('./routes/problemRoutes');
const progressRoutes = require('./routes/progressRoutes');
const executionRoutes = require('./routes/executionRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const visualizationRoutes = require('./routes/visualizationRoutes');

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static Frontend Serving — disable cache so browser always gets latest JS
app.use(express.static(path.join(__dirname, '../front end'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));
app.use('/visualizer', (req, res) => res.redirect('/visualizer.html'));

// Mount API Routers
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/problems', executionRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/', visualizationRoutes);

// Start Modular Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Modular AlgoMaster Server running on http://localhost:${PORT}`);
    console.log(`- Code Engine: Active (${path.join(__dirname, 'codeEngine')})`);
    console.log(`- Recommendation Engine: Active (${path.join(__dirname, 'recommendationEngine')})`);
    console.log(`- Visualization Engine: Active (${path.join(__dirname, 'visualizationEngine')})`);
});

module.exports = server;
