const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { 
  validateRating,
  validateReviewComment,
  validateImageFile,
  validateMongoId,
  validateRequired
} = require('./utils/validators');

const Restaurant = require('./models/Restaurant');
const Review = require('./models/Review');
const Like = require('./models/Like');
const authenticateToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/huequitas_core_db';

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Core Service: Connected to MongoDB'))
  .catch(err => console.error('❌ Core Service: MongoDB connection error:', err));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'core-service' });
});

// GET /restaurants - Get all restaurants
app.get('/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });
    res.json(restaurants);
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /restaurants/:id - Get single restaurant
app.get('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /restaurants - Create restaurant (requires auth)
app.post('/restaurants', authenticateToken, async (req, res) => {
  try {
    const { name, description, address, cuisine } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Restaurant name is required' });
    }

    const restaurant = new Restaurant({
      name,
      description,
      address,
      cuisine
    });

    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /restaurants/:id - Update restaurant (requires auth)
app.put('/restaurants/:id', authenticateToken, async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json(restaurant);
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /restaurants/:id - Delete restaurant (requires auth)
app.delete('/restaurants/:id', authenticateToken, async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Also delete related reviews and likes
    await Review.deleteMany({ restaurantId: req.params.id });
    await Like.deleteMany({ restaurantId: req.params.id });

    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /reviews - Create review (requires auth)
app.post('/reviews', authenticateToken, async (req, res) => {
  try {
    const { restaurantId, rating, comment, image } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name;

      // Validar restaurantId
    let validation = validateMongoId(restaurantId);
    if (!validation.valid) {
      return res.status(400).json({ error: 'ID de restaurante inválido' });
    }

    // Validar rating
    validation = validateRating(rating);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Validar comentario
    validation = validateReviewComment(comment);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Validar imagen
    validation = validateImageFile(image);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Create review
    const review = new Review({
      restaurantId,
      userId,
      userName,
      rating,
      comment,
      image
    });

    await review.save();

    // Update restaurant rating
    const reviews = await Review.find({ restaurantId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    restaurant.rating = parseFloat(avgRating.toFixed(2));
    restaurant.totalRatings = reviews.length;
    await restaurant.save();

    res.status(201).json(review);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /reviews/:reviewId - Edit review (requires auth)
app.put('/reviews/:reviewId', authenticateToken, async (req, res) => {
  try {
    const { rating, comment, image } = req.body;
    const userId = req.user.userId;

    // Validar ID de review
    let validation = validateMongoId(req.params.reviewId);
    if (!validation.valid) {
      return res.status(400).json({ error: 'ID de reseña inválido' });
    }

    // Validar rating
    validation = validateRating(rating);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Validar comentario
    validation = validateReviewComment(comment);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Validar imagen
    validation = validateImageFile(image);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Verificar que solo el dueño pueda editar
    if (review.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this review' });
    }

    // Actualizar review
    review.rating = rating;
    review.comment = comment || review.comment;
    review.image = image !== undefined ? image : review.image;
    review.updatedAt = Date.now();
    await review.save();

    // Recalcular rating del restaurante
    const reviews = await Review.find({ restaurantId: review.restaurantId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const restaurant = await Restaurant.findById(review.restaurantId);
    restaurant.rating = parseFloat(avgRating.toFixed(2));
    await restaurant.save();

    res.json(review);
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /reviews/:reviewId - Delete review (requires auth)
app.delete('/reviews/:reviewId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Validar ID de review
    const validation = validateMongoId(req.params.reviewId);
    if (!validation.valid) {
      return res.status(400).json({ error: 'ID de reseña inválido' });
    }

    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Verificar que solo el dueño pueda eliminar
    if (review.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    const restaurantId = review.restaurantId;
    await Review.findByIdAndDelete(req.params.reviewId);

    // Recalcular rating del restaurante
    const reviews = await Review.find({ restaurantId });
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      const restaurant = await Restaurant.findById(restaurantId);
      restaurant.rating = parseFloat(avgRating.toFixed(2));
      restaurant.totalRatings = reviews.length;
      await restaurant.save();
    } else {
      // Si no hay más reviews, resetear el rating
      const restaurant = await Restaurant.findById(restaurantId);
      restaurant.rating = 0;
      restaurant.totalRatings = 0;
      await restaurant.save();
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reviews/:restaurantId - Get reviews for a restaurant
app.get('/reviews/:restaurantId', async (req, res) => {
  try {
    const reviews = await Review.find({ restaurantId: req.params.restaurantId })
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /like - Like/unlike a restaurant (requires auth)
app.post('/like', authenticateToken, async (req, res) => {
  try {
    const { restaurantId } = req.body;
    const userId = req.user.userId;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check if like already exists
    const existingLike = await Like.findOne({ restaurantId, userId });

    if (existingLike) {
      // Unlike - remove the like
      await Like.findByIdAndDelete(existingLike._id);
      res.json({ message: 'Restaurant unliked', liked: false });
    } else {
      // Like - create new like
      const like = new Like({ restaurantId, userId });
      await like.save();
      res.json({ message: 'Restaurant liked', liked: true });
    }
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate like (shouldn't happen but handle it)
      res.json({ message: 'Restaurant already liked', liked: true });
    } else {
      console.error('Like error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /likes/:restaurantId - Get like status for a restaurant (requires auth)
app.get('/likes/:restaurantId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const like = await Like.findOne({
      restaurantId: req.params.restaurantId,
      userId
    });

    res.json({ liked: !!like });
  } catch (error) {
    console.error('Get like status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/seed', async (req, res) => {
  try {
    await Restaurant.deleteMany({});

    const huecas = [
      {
        name: "Los Motes de San Juan",
        description: "El mote con chicharrón más clásico y crujiente de Quito.",
        address: "San Juan, Quito",
        cuisine: "Típica", // Coincide con el filtro del Front
        image: "https://images.pexels.com/photos/2059151/pexels-photo-2059151.jpeg?auto=compress&cs=tinysrgb&w=600"
      },
      {
        name: "Las Tripas de la Vicentina",
        description: "Tripa mishqui al carbón, con papas y salsa de maní.",
        address: "La Vicentina",
        cuisine: "Callejera", // Coincide con el filtro del Front
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tripa_Mishqui.jpg/800px-Tripa_Mishqui.jpg"
      },
      {
        name: "Ceviches de la Rumiñahui",
        description: "Ceviche de camarón, concha y mixto con harto limón.",
        address: "Av. Rumiñahui",
        cuisine: "Mariscos", // Coincide con el filtro del Front
        image: "https://images.pexels.com/photos/699953/pexels-photo-699953.jpeg?auto=compress&cs=tinysrgb&w=600"
      },
      {
        name: "Helados de Paila de Pomasqui",
        description: "Helados tradicionales hechos a mano en paila de bronce.",
        address: "Pomasqui Central",
        cuisine: "Postres", // Coincide con el filtro del Front
        image: "https://images.pexels.com/photos/5060281/pexels-photo-5060281.jpeg?auto=compress&cs=tinysrgb&w=600"
      }
    ];

    const created = await Restaurant.insertMany(huecas);
    res.json({ message: '¡Huecas sembradas con imágenes!', count: created.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🍽️  Core service running on port ${PORT}`);
});
