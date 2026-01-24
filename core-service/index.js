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
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
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

// GET /restaurants - Get all restaurants with optional filters
app.get('/restaurants', async (req, res) => {
  try {
    const { cuisines, location } = req.query;
    let filter = {};

    // Filtrar por tipos de comida (puede ser múltiple, separado por comas)
    if (cuisines) {
      const cuisineArray = cuisines.split(',').map(c => c.trim());
      filter.cuisine = { $in: cuisineArray };
    }

    // Filtrar por sector/ubicación
    if (location) {
      filter['location.sector'] = location;
    }

    const restaurants = await Restaurant.find(filter).sort({ createdAt: -1 });
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

// --- GENERADOR MASIVO DE 80 HUECAS (SMART SEEDER) ---
app.post('/seed', async (req, res) => {
  try {
    // 1. Limpiamos la base de datos previa
    await Restaurant.deleteMany({});

    // 2. Datos de configuración
    const sectors = ['Norte', 'Centro', 'Sur', 'Valles'];
    const cuisines = ['Típica', 'Callejera', 'Mariscos', 'Postres'];

    // Coordenadas base aproximadas de cada sector en Quito
    const baseCoords = {
      'Norte': { lat: -0.1600, lng: -78.4800 },   // La Carolina / Iñaquito
      'Centro': { lat: -0.2200, lng: -78.5100 },  // Centro Histórico
      'Sur': { lat: -0.2800, lng: -78.5400 },     // Quitumbe / Chillogallo
      'Valles': { lat: -0.2000, lng: -78.4300 }   // Cumbayá
    };

    // Diccionario para generar nombres realistas
    const dataDict = {
      names: ["Luchito", "La Vecina", "Don Pepe", "Doña Mary", "El Paisa", "Rosita", "Jorgito", "Mama Miche", "El Gato", "Bolívar"],
      prefixes: ["El Rincón de", "Las Delicias de", "Antojitos", "La Hueca de", "Sabores de", "Don", "Doña", "El Palacio de"],
      
      // Platos específicos por categoría para el nombre
      'Típica': ["Hornado", "Fritada", "Mote", "Yahuarlocro", "Seco de Chivo"],
      'Callejera': ["Tripas", "Empanadas", "Choclos", "Salchipapas", "Pinchos"],
      'Mariscos': ["Ceviche", "Encebollado", "Corviche", "Cangrejada", "Viche"],
      'Postres': ["Helados", "Espumilla", "Higos", "Quesadillas", "Pristiños"]
    };

    // Imágenes rotativas para que no se vea monótono
    const images = {
      'Típica': [
        "https://images.pexels.com/photos/2059151/pexels-photo-2059151.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/7613568/pexels-photo-7613568.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/6941010/pexels-photo-6941010.jpeg?auto=compress&cs=tinysrgb&w=600"
      ],
      'Callejera': [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tripa_Mishqui.jpg/800px-Tripa_Mishqui.jpg",
        "https://images.pexels.com/photos/6646069/pexels-photo-6646069.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/4955253/pexels-photo-4955253.jpeg?auto=compress&cs=tinysrgb&w=600"
      ],
      'Mariscos': [
        "https://images.pexels.com/photos/699953/pexels-photo-699953.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/8697540/pexels-photo-8697540.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/1683545/pexels-photo-1683545.jpeg?auto=compress&cs=tinysrgb&w=600"
      ],
      'Postres': [
        "https://images.pexels.com/photos/5060281/pexels-photo-5060281.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/2135/food-france-morning-breakfast.jpg?auto=compress&cs=tinysrgb&w=600"
      ]
    };

    const generatedHuecas = [];

    // 3. EL ALGORITMO GENERADOR (Triple Bucle)
    for (const sector of sectors) {
      for (const cuisine of cuisines) {
        // Generar 5 restaurantes para esta combinación Sector + Cocina
        for (let i = 0; i < 5; i++) {
          
          // Seleccionar elementos aleatorios
          const prefix = dataDict.prefixes[Math.floor(Math.random() * dataDict.prefixes.length)];
          const name = dataDict.names[Math.floor(Math.random() * dataDict.names.length)];
          const dish = dataDict[cuisine][i % 5]; // Usar platos variados cíclicamente
          const imgUrl = images[cuisine][Math.floor(Math.random() * images[cuisine].length)];

          // Generar coordenadas con variación (jitter) para que no se solapen en un mapa
          const latJitter = (Math.random() * 0.02) - 0.01; // +/- 1km aprox
          const lngJitter = (Math.random() * 0.02) - 0.01;

          const hueca = {
            name: `${prefix} ${name} - ${dish}`,
            description: `Disfruta del mejor ${dish} en el sector ${sector}. Sabor auténtico quiteño garantizado.`,
            address: `Calle Principal N${Math.floor(Math.random()*100)} y Transversal, ${sector}`,
            cuisine: cuisine,
            image: imgUrl,
            location: {
              sector: sector,
              coordinates: {
                lat: baseCoords[sector].lat + latJitter,
                lng: baseCoords[sector].lng + lngJitter
              }
            },
            // Rating aleatorio entre 3.5 y 5.0
            rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
            totalRatings: Math.floor(Math.random() * 150) + 10,
            createdAt: new Date()
          };

          generatedHuecas.push(hueca);
        }
      }
    }

    // 4. Insertar en MongoDB
    const created = await Restaurant.insertMany(generatedHuecas);
    
    console.log(`🌱 Seed completado: ${created.length} huecas creadas.`);
    res.json({ 
      message: '¡Base de datos poblada exitosamente!', 
      total: created.length,
      detail: '80 restaurantes distribuidos equitativamente por sector y categoría.'
    });

  } catch (error) {
    console.error('Error seeding:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🍽️  Core service running on port ${PORT}`);
});
