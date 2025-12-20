/**
 * Cloudflare Workers Entry Point using Hono Framework
 * 
 * This is a better approach - using Hono which is designed for Workers.
 * You'll need to refactor your Express routes to use Hono.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Note: You'll need to install: npm install hono
// And refactor your Express routes to use Hono

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    success: true,
    message: '🚀 Sanora Backend API is running on Cloudflare Workers!',
    timestamp: new Date().toISOString(),
    endpoints: {
      signup: 'POST /api/auth/signup',
      login: 'POST /api/auth/login',
      googleAuth: 'GET /api/auth/google',
      googleAuthMobile: 'POST /api/auth/google/mobile',
      verifyGoogleToken: 'POST /api/auth/verify-google-token',
      sendOTPSignup: 'POST /api/auth/send-otp-signup',
      verifyOTPSignup: 'POST /api/auth/verify-otp-signup'
    }
  });
});

// Auth routes placeholder
// You'll need to refactor your Express routes from:
// - src/routes/authRoutes.js
// - src/controllers/authController.js
// To use Hono instead

app.get('/api', (c) => {
  return c.json({
    success: true,
    message: 'API is running',
    version: '1.0.0'
  });
});

// Example auth route structure (you'll need to implement these)
const authRoutes = new Hono();

authRoutes.post('/signup', async (c) => {
  // Refactor your signup logic here
  // Instead of req.body, use: const body = await c.req.json()
  // Instead of res.json(), use: return c.json()
  return c.json({ message: 'Signup endpoint - needs implementation' }, 501);
});

authRoutes.post('/login', async (c) => {
  return c.json({ message: 'Login endpoint - needs implementation' }, 501);
});

app.route('/api/auth', authRoutes);

// Chat routes
// Note: These routes require the Express backend with Mongoose support
// If you're using Cloudflare Workers, you may need to proxy to your Express server
// or refactor to use MongoDB native driver instead of Mongoose
const chatRoutes = new Hono();

// Authentication middleware for Hono (similar to Express protect middleware)
const protectChat = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        message: 'Not authorized to access this route'
      }, 401);
    }
    
    const token = authHeader.split(' ')[1];
    // TODO: Verify JWT token and set c.set('user', user)
    // For now, we'll need to import JWT verification logic
    // This is a placeholder - you'll need to implement full auth
    
    await next();
  } catch (error) {
    return c.json({
      success: false,
      message: 'Not authorized, token failed'
    }, 401);
  }
};

// Apply auth middleware to all chat routes
chatRoutes.use('*', protectChat);

// Get all conversations for the authenticated user
chatRoutes.get('/conversations', async (c) => {
  // TODO: Implement using MongoDB native driver or proxy to Express backend
  // For now, return a helpful error
  return c.json({
    success: false,
    message: 'Chat routes are not fully implemented in Cloudflare Workers yet',
    hint: 'This endpoint requires Mongoose models. Consider proxying to your Express backend or refactoring to use MongoDB native driver.',
    path: c.req.path
  }, 501);
});

// Get or create a conversation with a specific user
chatRoutes.get('/conversation/:participantId', async (c) => {
  return c.json({
    success: false,
    message: 'Chat routes are not fully implemented in Cloudflare Workers yet',
    hint: 'This endpoint requires Mongoose models. Consider proxying to your Express backend or refactoring to use MongoDB native driver.',
    path: c.req.path
  }, 501);
});

// Get messages for a conversation
chatRoutes.get('/conversation/:conversationId/messages', async (c) => {
  return c.json({
    success: false,
    message: 'Chat routes are not fully implemented in Cloudflare Workers yet',
    hint: 'This endpoint requires Mongoose models. Consider proxying to your Express backend or refactoring to use MongoDB native driver.',
    path: c.req.path
  }, 501);
});

// Send a message
chatRoutes.post('/message', async (c) => {
  return c.json({
    success: false,
    message: 'Chat routes are not fully implemented in Cloudflare Workers yet',
    hint: 'This endpoint requires Mongoose models. Consider proxying to your Express backend or refactoring to use MongoDB native driver.',
    path: c.req.path
  }, 501);
});

// Delete a message
chatRoutes.delete('/message/:messageId', async (c) => {
  return c.json({
    success: false,
    message: 'Chat routes are not fully implemented in Cloudflare Workers yet',
    hint: 'This endpoint requires Mongoose models. Consider proxying to your Express backend or refactoring to use MongoDB native driver.',
    path: c.req.path
  }, 501);
});

// Mark messages as read
chatRoutes.post('/messages/read', async (c) => {
  return c.json({
    success: false,
    message: 'Chat routes are not fully implemented in Cloudflare Workers yet',
    hint: 'This endpoint requires Mongoose models. Consider proxying to your Express backend or refactoring to use MongoDB native driver.',
    path: c.req.path
  }, 501);
});

// Get unread message count
chatRoutes.get('/unread-count', async (c) => {
  return c.json({
    success: false,
    message: 'Chat routes are not fully implemented in Cloudflare Workers yet',
    hint: 'This endpoint requires Mongoose models. Consider proxying to your Express backend or refactoring to use MongoDB native driver.',
    path: c.req.path
  }, 501);
});

app.route('/api/chat', chatRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    message: 'Route not found',
    method: c.req.method,
    path: c.req.path,
    hint: 'Make sure you are using the correct HTTP method and path.'
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    message: 'Internal server error',
    error: err.message
  }, 500);
});

export default app;

