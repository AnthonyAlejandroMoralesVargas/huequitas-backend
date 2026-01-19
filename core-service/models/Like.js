const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure one like per user per restaurant
likeSchema.index({ restaurantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
