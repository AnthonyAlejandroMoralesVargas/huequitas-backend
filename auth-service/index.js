const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });


const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { 
  validateEmail, 
  validateName, 
  validatePasswordStrength,
  validateRequired,
  validateConfirmPassword
} = require('./utils/validators');
const { sendResetEmail } = require('./config/mailer');

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
    validation = validateConfirmPassword(password, confirmPassword);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

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

    // Validar email requerido
    let validation = validateRequired(email, 'Email');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar formato de email
    validation = validateEmail(email);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    const user = await User.findOne({ email });
    
    // Por seguridad, no revelar si el email existe
    if (!user) {
      return res.json({ message: 'Si el email existe en nuestro sistema, recibirás un código en tu bandeja de entrada' });
    }

    // Generar código de 6 dígitos
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    
    // Generar token también para almacenamiento (por si acaso)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Guardar código y token (válido por 15 minutos)
    user.resetToken = resetToken;
    user.resetCode = resetCode;
    user.resetTokenExpiry = Date.now() + 900000; // 15 minutos
    await user.save();

    // Enviar email con el código
    try {
      await sendResetEmail(user.email, resetCode);
    } catch (emailError) {
      console.error('Error al enviar email:', emailError);
      return res.status(500).json({ error: 'No pudimos enviar el email de reseteo. Por favor intenta más tarde.' });
    }

    // Respuesta genérica por seguridad
    res.json({ 
      message: 'Si el email existe en nuestro sistema, recibirás un código en tu bandeja de entrada',
      success: true 
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de reseteo' });
  }
});

// Verify reset code endpoint (NEW)
app.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, resetCode } = req.body;

    // Validar campos
    let validation = validateRequired(email, 'Email');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(resetCode, 'Código de reseteo');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Buscar usuario con código válido y no expirado
    const user = await User.findOne({
      email,
      resetCode,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'El código de reseteo es inválido o ha expirado. Por favor solicita un nuevo código.' });
    }

    // Retornar token temporal para que el frontend pueda resetear la contraseña
    const tempToken = jwt.sign(
      { userId: user._id, email: user.email, isReset: true },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      message: 'Código verificado correctamente. Ahora puedes resetear tu contraseña.',
      success: true,
      tempToken
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({ error: 'Error al verificar el código de reseteo' });
  }
});

// Password reset endpoint
app.post('/password-reset', async (req, res) => {
  try {
    const { email, resetCode, newPassword, confirmPassword } = req.body;

    // Validar campos requeridos
    let validation = validateRequired(email, 'Email');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(resetCode, 'Código de reseteo');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(newPassword, 'Nueva contraseña');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    validation = validateRequired(confirmPassword, 'Confirmación de contraseña');
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar que las contraseñas coincidan
    validation = validateConfirmPassword(newPassword, confirmPassword);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Validar fortaleza de la nueva contraseña
    validation = validatePasswordStrength(newPassword);
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    // Buscar usuario con código válido y no expirado
    const user = await User.findOne({
      email,
      resetCode,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'El código de reseteo es inválido o ha expirado. Solicita un nuevo reseteo.' });
    }

    // Actualizar contraseña y limpiar tokens/códigos
    user.password = newPassword;
    user.resetToken = null;
    user.resetCode = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ 
      message: 'Tu contraseña ha sido restablecida exitosamente. Por favor, inicia sesión con tu nueva contraseña.',
      success: true 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Error al resetear la contraseña. Por favor intenta más tarde.' });
  }
});

// Old password reset endpoint (kept for backward compatibility but uses old method)

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
