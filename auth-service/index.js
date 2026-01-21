const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();
const { 
  validateEmail, 
  validateName, 
  validatePasswordStrength,
  validateRequired 
} = require('./utils/validators');

const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/huequitas_auth_db';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Auth Service: Connected to MongoDB'))
.catch(err => console.error('❌ Auth Service: MongoDB connection error:', err));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'auth-service' });
});

// Register endpoint
app.post('/register', async (req, res) => {
  try {
    const { email, password, name, confirmPassword } = req.body;

      // Validar campos requeridos
    let validation = validateRequired(email, 'Email');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(password, 'Contraseña');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(name, 'Nombre');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(confirmPassword, 'Confirmar contraseña');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar email
    validation = validateEmail(email);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar nombre
    validation = validateName(name);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar contraseña fuerte
    validation = validatePasswordStrength(password);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const user = new User({ email, password, name });
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

   // Validar campos requeridos
    let validation = validateRequired(email, 'Email');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(password, 'Contraseña');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar email
    validation = validateEmail(email);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Password reset request endpoint
app.post('/password-reset-request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If email exists, reset link will be sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    // In production, send email with reset link
    // For now, return token (remove in production)
    res.json({
      message: 'Password reset token generated',
      resetToken // Remove this in production - only send via email
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Password reset endpoint
app.post('/password-reset', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint (useful for other services)
app.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ valid: true, user: { id: user._id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Auth service running on port ${PORT}`);
});
