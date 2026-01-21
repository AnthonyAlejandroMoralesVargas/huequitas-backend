const MAX_COMMENT_LENGTH = 250;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

// Email validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { valid: false, message: 'El email debe ser válido (ejemplo@dominio.com)' };
  }
  return { valid: true };
};

// Name validation
const validateName = (name) => {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'El nombre es requerido' };
  }
  if (name.trim().length < 3 || name.trim().length > 50) {
    return { valid: false, message: 'El nombre debe tener entre 3 y 50 caracteres' };
  }
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
  if (!nameRegex.test(name)) {
    return { valid: false, message: 'El nombre solo puede contener letras y espacios' };
  }
  return { valid: true };
};

// Password strength validation
const validatePasswordStrength = (password) => {
  if (!password) {
    return { valid: false, message: 'La contraseña es requerida' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'La contraseña debe tener mínimo 6 caracteres' };
  }
  
  let score = 1; // Base: longitud mínima
  const issues = [];
  
  // Verificar minúsculas
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    issues.push('minúsculas');
  }
  
  // Verificar mayúsculas
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    issues.push('mayúsculas');
  }
  
  // Verificar números
  if (/[0-9]/.test(password)) {
    score++;
  } else {
    issues.push('números');
  }
  
  // Score mínimo requerido: 3 (longitud + 2 de los 3 criterios)
  // Ejemplo: minúsculas + mayúsculas = 3 ✅
  // Ejemplo: solo números = 2 ❌
  if (score < 3) {
    return { 
      valid: false, 
      score, 
      message: `La contraseña es muy débil. Añade: ${issues.join(', ')}` 
    };
  }
  
  return { valid: true, score };
};

// Required field validation
const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { valid: false, message: `${fieldName} es requerido` };
  }
  return { valid: true };
};

module.exports = {
  validateEmail,
  validateName,
  validatePasswordStrength,
  validateRequired,
  MAX_COMMENT_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_FORMATS
};