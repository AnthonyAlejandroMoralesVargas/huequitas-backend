const MAX_COMMENT_LENGTH = 250;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

// Rating validation
const validateRating = (rating) => {
  const ratingNum = Number(rating);
  if (!rating || isNaN(ratingNum)) {
    return { valid: false, message: 'La calificación es requerida' };
  }
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return { valid: false, message: 'La calificación debe ser un número entre 1 y 5' };
  }
  return { valid: true };
};

// Review comment validation
const validateReviewComment = (comment) => {
  if (comment && comment.trim().length > MAX_COMMENT_LENGTH) {
    return { 
      valid: false, 
      message: `El comentario no puede exceder ${MAX_COMMENT_LENGTH} caracteres (tienes ${comment.length})` 
    };
  }
  return { valid: true };
};

// Image file validation (base64)
const validateImageFile = (base64String) => {
  if (!base64String) {
    return { valid: true }; // Image is optional
  }
  
  // Check if it's a valid base64 string
  if (typeof base64String !== 'string' || !base64String.includes('data:image')) {
    return { 
      valid: false, 
      message: 'La imagen no tiene un formato válido' 
    };
  }
  
  // Extract mime type
  const mimeMatch = base64String.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : null;
  
  if (!mimeType || !ALLOWED_IMAGE_FORMATS.includes(mimeType)) {
    return { 
      valid: false, 
      message: 'Solo se permiten imágenes JPG, PNG o GIF' 
    };
  }
  
  // Check size (base64 is ~33% larger than binary)
  const sizeInBytes = (base64String.length * 3) / 4;
  if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
    return { 
      valid: false, 
      message: `La imagen no puede exceder 5MB (tamaño actual: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB)` 
    };
  }
  
  return { valid: true };
};

// MongoID validation
const validateMongoId = (id) => {
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return { valid: false, message: 'ID inválido' };
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
  validateRating,
  validateReviewComment,
  validateImageFile,
  validateMongoId,
  validateRequired,
  MAX_COMMENT_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_FORMATS
};