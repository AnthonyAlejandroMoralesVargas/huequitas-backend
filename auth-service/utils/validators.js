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
  
  const issues = [];
  
  // Verificar longitud mínima de 8 caracteres
  if (password.length < 8) {
    issues.push('al menos 8 caracteres');
  }
  
  // Verificar minúsculas (a-z)
  if (!/[a-z]/.test(password)) {
    issues.push('letras minúsculas (a-z)');
  }
  
  // Verificar mayúsculas (A-Z)
  if (!/[A-Z]/.test(password)) {
    issues.push('letras mayúsculas (A-Z)');
  }
  
  // Verificar números (0-9)
  if (!/[0-9]/.test(password)) {
    issues.push('números (0-9)');
  }
  
  // Verificar símbolos especiales (!@#$%^&*...)
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    issues.push('símbolos especiales (!@#$%^&*...)');
  }
  
  // Si hay algún requisito no cumplido, retornar error
  if (issues.length > 0) {
    return { 
      valid: false, 
      message: `La contraseña debe incluir: ${issues.join(', ')}` 
    };
  }
  
  return { valid: true };
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