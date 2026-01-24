const express = require('express');
const proxy = require('express-http-proxy');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Get service URLs from environment variables
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3002';
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:3003';

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'gateway' });
});

// Route: /auth/* -> Auth Service
app.use('/auth', proxy(AUTH_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    // Remove /auth prefix before forwarding
    return req.url.replace(/^\/auth/, '') || '/';
  }
}));

// Route: /api/* -> Core Service
app.use('/api', proxy(CORE_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    // Remove /api prefix before forwarding
    return req.url.replace(/^\/api/, '') || '/';
  }
}));

// Route: /chat/* -> Chat Service
app.use('/chat', proxy(CHAT_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    // Remove /chat prefix before forwarding
    return req.url.replace(/^\/chat/, '') || '/';
  }
}));

app.listen(PORT, () => {
  console.log(`🚀 Gateway service running on port ${PORT}`);
  console.log(`   /auth/* -> ${AUTH_SERVICE_URL}`);
  console.log(`   /api/* -> ${CORE_SERVICE_URL}`);
  console.log(`   /chat/* -> ${CHAT_SERVICE_URL}`);
});
