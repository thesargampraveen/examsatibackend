const express = require('express');
const connectDB = require('./src/db/db');

const app = express();
app.use(express.json());

// basic request log
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/', (_req, res) => {
  res.json({ app: 'ExamSaathi API', status: 'running' });
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/centers', require('./src/routes/centers'));
app.use('/api/partners', require('./src/routes/partners'));
app.use('/api/connections', require('./src/routes/connections'));
app.use('/api/chat', require('./src/routes/chat'));
app.use('/api/groups', require('./src/routes/groups'));
app.use('/api/guide', require('./src/routes/guide'));
app.use('/api/safety', require('./src/routes/safety'));
app.use('/api/checklist', require('./src/routes/checklist'));

// 404 handler
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

// error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`ExamSaathi server running on port ${PORT}`);
  });
});
