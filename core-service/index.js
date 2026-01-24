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

// --- GENERADOR DE 80 HUECAS ---
app.post('/seed', async (req, res) => {
  try {
    // 1. Limpiar BD
    await Restaurant.deleteMany({});

    // 2. Coordenadas Base para los sectores
    const baseCoords = {
      'Norte': { lat: -0.1600, lng: -78.4800 },
      'Centro': { lat: -0.2200, lng: -78.5100 },
      'Sur': { lat: -0.2800, lng: -78.5400 },
      'Valles': { lat: -0.2000, lng: -78.4300 }
    };

    // 3. LA GRAN LISTA DE DATOS (Estructurada por Sector > Categoría)
    const database = {
      'Norte': {
        'Típica': [
          { name: "El Rincón de Luchito - Hornado", img: "https://upload.wikimedia.org/wikipedia/commons/3/34/Ama_la_Vida_-_Flickr_-_Imbabura_Hornado_%2823%29_%2814294973591%29.jpg" },
          { name: "Las Delicias de La Vecina - Fritada", img: "https://upload.wikimedia.org/wikipedia/commons/6/60/CUENCA_-_CIUDAD_-_GENTE_-_GASTRONOM%C3%8DA_%2818136357868%29.jpg" },
          { name: "Antojitos Don Pepe - Mote", img: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Plato_de_jam%C3%B3n_huaracino_con_papa%2C_mote_y_ensalada_02.jpg" },
          { name: "La Hueca de Doña Mary - Yahuarlocro", img: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Plato_de_Yahuarlocro.jpg" },
          { name: "Sabores de El Paisa - Seco de Chivo", img: "https://upload.wikimedia.org/wikipedia/commons/2/21/Seco_de_chivo.jpg" }
        ],
        'Callejera': [
          { name: "Don Rosita - Tripas", img: "https://upload.wikimedia.org/wikipedia/commons/3/3a/200611925_1788471ce7_o_d.jpg" },
          { name: "Doña Jorgito - Empanadas", img: "https://upload.wikimedia.org/wikipedia/commons/9/97/Empanada_-_Stu_Spivack.jpg" },
          { name: "El Palacio de Mama Miche - Choclos", img: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Queso_humacha_La_Paz.jpg" },
          { name: "La Casa de El Gato - Salchipapas", img: "https://upload.wikimedia.org/wikipedia/commons/3/32/Lima_salchipapas_%28cropped%29.jpg" },
          { name: "Los Agachaditos de Bolívar - Pinchos", img: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Brochette_d%27espadon_%C3%A0_Georgio%C3%BApoli_%28Cr%C3%A8te%29_en_juillet_2021.jpg" }
        ],
        'Mariscos': [
          { name: "El Rincón de Luchito - Ceviche", img: "https://upload.wikimedia.org/wikipedia/commons/0/0e/CEVICHE_DE_CAMAR%C3%93N_ECUATORIANO.jpg" },
          { name: "Las Delicias de La Vecina - Encebollado", img: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Semifinal_del_Campeonato_del_Encebollado_en_Esmeraldas_2015_%2818062294436%29.jpg" },
          { name: "Antojitos Don Pepe - Corviche", img: "https://upload.wikimedia.org/wikipedia/commons/7/74/Corviche_de_pescado_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" },
          { name: "La Hueca de Doña Mary - Cangrejada", img: "https://upload.wikimedia.org/wikipedia/commons/6/64/Cangrejada.jpg" },
          { name: "Sabores de El Paisa - Viche", img: "https://upload.wikimedia.org/wikipedia/commons/7/75/Viche_de_pescado_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" }
        ],
        'Postres': [
          { name: "Don Rosita - Helados", img: "https://upload.wikimedia.org/wikipedia/commons/0/0f/HELADOS_DE_PAILA_%2840475435140%29.jpg" },
          { name: "Doña Jorgito - Espumilla", img: "https://upload.wikimedia.org/wikipedia/commons/8/80/Espumilla.jpg" },
          { name: "El Palacio de Mama Miche - Higos", img: "https://upload.wikimedia.org/wikipedia/commons/6/62/Higos_con_queso.jpg" },
          { name: "La Casa de El Gato - Quesadillas", img: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Dulces_t%C3%ADpicos_de_Gualaceo.jpg" },
          { name: "Los Agachaditos de Bolívar - Pristiños", img: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Pristi%C3%B1os_acompa%C3%B1ados_con_higos_con_queso_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" }
        ]
      },
      'Centro': {
        'Típica': [
          { name: "El Rincón de Luchito - Hornado", img: "https://upload.wikimedia.org/wikipedia/commons/1/18/Ama_la_Vida_-_Flickr_-_Cotopaxi_Hornado_%2818%29_%2814297773574%29.jpg" },
          { name: "Las Delicias de La Vecina - Fritada", img: "https://upload.wikimedia.org/wikipedia/commons/b/b9/IMA-20180603_162329.jpg" },
          { name: "Antojitos Don Pepe - Mote", img: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Mote_pata_cuencano.jpg" },
          { name: "La Hueca de Doña Mary - Yahuarlocro", img: "https://upload.wikimedia.org/wikipedia/commons/4/49/Yahuarlocro_%28Ecuador%29.jpg" },
          { name: "Sabores de El Paisa - Seco de Chivo", img: "https://upload.wikimedia.org/wikipedia/commons/1/14/Seco2.jpg" }
        ],
        'Callejera': [
          { name: "Don Rosita - Tripas", img: "https://upload.wikimedia.org/wikipedia/commons/8/80/Tripitas_durango.jpg" },
          { name: "Doña Jorgito - Empanadas", img: "https://upload.wikimedia.org/wikipedia/commons/4/47/Vigan_Empanada.jpg" },
          { name: "El Palacio de Mama Miche - Choclos", img: "https://upload.wikimedia.org/wikipedia/commons/4/46/Gastronomia_costarricense.JPG" },
          { name: "La Casa de El Gato - Salchipapas", img: "https://upload.wikimedia.org/wikipedia/commons/8/81/Salchipapa_especial.jpg" },
          { name: "Los Agachaditos de Bolívar - Pinchos", img: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Pinchos_-_fugzu.jpg" }
        ],
        'Mariscos': [
          { name: "El Rincón de Luchito - Ceviche", img: "https://upload.wikimedia.org/wikipedia/commons/2/20/Ceviche_de_pescado_%2850915656663%29.jpg" },
          { name: "Las Delicias de La Vecina - Encebollado", img: "https://upload.wikimedia.org/wikipedia/commons/7/71/Ecuadorian_food.jpg" },
          { name: "Antojitos Don Pepe - Corviche", img: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Corviches_ecuatorianos.jpg" },
          { name: "La Hueca de Doña Mary - Cangrejada", img: "https://upload.wikimedia.org/wikipedia/commons/6/64/Cangrejada.jpg" },
          { name: "Sabores de El Paisa - Viche", img: "https://upload.wikimedia.org/wikipedia/commons/8/88/Viche_Chonero.jpg" }
        ],
        'Postres': [
          { name: "Don Rosita - Helados", img: "https://upload.wikimedia.org/wikipedia/commons/5/58/Quito%2C_helado_de_paila%2C_street_food%2C_ice_cream.jpg" },
          { name: "Doña Jorgito - Espumilla", img: "https://upload.wikimedia.org/wikipedia/commons/8/80/Espumilla.jpg" },
          { name: "El Palacio de Mama Miche - Higos", img: "https://upload.wikimedia.org/wikipedia/commons/d/de/Pan_de_higos_-_Apilamiento.JPG" },
          { name: "La Casa de El Gato - Quesadillas", img: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Dulces_t%C3%ADpicos_de_Gualaceo.jpg" },
          { name: "Los Agachaditos de Bolívar - Pristiños", img: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Pristi%C3%B1os_acompa%C3%B1ados_con_higos_con_queso_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" }
        ]
      },
      'Sur': {
        'Típica': [
          { name: "El Rincón de Luchito - Hornado", img: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Hornado_Pastuso.jpg" },
          { name: "Las Delicias de La Vecina - Fritada", img: "https://upload.wikimedia.org/wikipedia/commons/5/58/Fritada_de_setas_de_cardo_y_robellones%2C_gastronom%C3%ADa_comarca_Maestrazgo.jpg" },
          { name: "Antojitos Don Pepe - Mote", img: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Mote-pillo.jpg" },
          { name: "La Hueca de Doña Mary - Yahuarlocro", img: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Plato_de_Yahuarlocro.jpg" },
          { name: "Sabores de El Paisa - Seco de Chivo", img: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Seco_de_chivo_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" }
        ],
        'Callejera': [
          { name: "Don Rosita - Tripas", img: "https://upload.wikimedia.org/wikipedia/commons/4/45/Tripas_rellenas_en_el_Mercado_Abasto.jpg" },
          { name: "Doña Jorgito - Empanadas", img: "https://upload.wikimedia.org/wikipedia/commons/8/8c/Empanadas_argentinas_de_carne_%28fritas%29.jpg" },
          { name: "El Palacio de Mama Miche - Choclos", img: "https://upload.wikimedia.org/wikipedia/commons/8/82/Queso_humacha_3.jpg" },
          { name: "La Casa de El Gato - Salchipapas", img: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Salchipapa_Coste%C3%B1o.jpg" },
          { name: "Los Agachaditos de Bolívar - Pinchos", img: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Tapas_Barcelona.jpg" }
        ],
        'Mariscos': [
          { name: "El Rincón de Luchito - Ceviche", img: "https://upload.wikimedia.org/wikipedia/commons/6/66/Ceviche_ecuador.JPG" },
          { name: "Las Delicias de La Vecina - Encebollado", img: "https://upload.wikimedia.org/wikipedia/commons/6/66/Encebollado_mixtoo.jpg" },
          { name: "Antojitos Don Pepe - Corviche", img: "https://upload.wikimedia.org/wikipedia/commons/7/74/Corviche_de_pescado_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" },
          { name: "La Hueca de Doña Mary - Cangrejada", img: "https://upload.wikimedia.org/wikipedia/commons/6/64/Cangrejada.jpg" },
          { name: "Sabores de El Paisa - Viche", img: "https://upload.wikimedia.org/wikipedia/commons/7/75/Viche_de_pescado_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" }
        ],
        'Postres': [
          { name: "Don Rosita - Helados", img: "https://upload.wikimedia.org/wikipedia/commons/7/71/HELADOS_DE_PAILA_%2842235453952%29.jpg" },
          { name: "Doña Jorgito - Espumilla", img: "https://upload.wikimedia.org/wikipedia/commons/7/70/Manzanas%2C_gelatina_y_espumilla.JPG" },
          { name: "El Palacio de Mama Miche - Higos", img: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Cohete_almeria_dulce.jpg" },
          { name: "La Casa de El Gato - Quesadillas", img: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Dulces_t%C3%ADpicos_de_Gualaceo.jpg" },
          { name: "Los Agachaditos de Bolívar - Pristiños", img: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Pristi%C3%B1os_acompa%C3%B1ados_con_higos_con_queso_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" }
        ]
      },
      'Valles': {
        'Típica': [
          { name: "El Rincón de Luchito - Hornado", img: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Ama_la_Vida_-_Flickr_-_Azuay_Hornado_%283%29_%2814318538733%29.jpg" },
          { name: "Las Delicias de La Vecina - Fritada", img: "https://upload.wikimedia.org/wikipedia/commons/8/8c/Fritada_de_verduras_con_costilla_de_cerdo.jpg" },
          { name: "Antojitos Don Pepe - Mote", img: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Mondongo_Chuquisaque%C3%B1o.jpg" },
          { name: "La Hueca de Doña Mary - Yahuarlocro", img: "https://upload.wikimedia.org/wikipedia/commons/4/49/Yahuarlocro_%28Ecuador%29.jpg" },
          { name: "Sabores de El Paisa - Seco de Chivo", img: "https://upload.wikimedia.org/wikipedia/commons/4/46/Seco_de_chivo_de_zapotal.jpg" }
        ],
        'Callejera': [
          { name: "Don Rosita - Tripas", img: "https://upload.wikimedia.org/wikipedia/commons/4/45/Tripas_rellenas_en_el_Mercado_Abasto.jpg" },
          { name: "Doña Jorgito - Empanadas", img: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Empanadas_argentinas_%28docena_fritas_de_carne%29.jpg" },
          { name: "El Palacio de Mama Miche - Choclos", img: "https://upload.wikimedia.org/wikipedia/commons/d/d6/Queso_humacha_2.jpg" },
          { name: "La Casa de El Gato - Salchipapas", img: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Salchipapas_20220704_121159.jpg" },
          { name: "Los Agachaditos de Bolívar - Pinchos", img: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Pincho_moruna_brocheta.jpg" }
        ],
        'Mariscos': [
          { name: "El Rincón de Luchito - Ceviche", img: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Ceviche_ecuatoriano_de_camar%C3%B3n.jpg" },
          { name: "Las Delicias de La Vecina - Encebollado", img: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Encebollado_Ecuatoriano.png.jpg" },
          { name: "Antojitos Don Pepe - Corviche", img: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Corviches_ecuatorianos.jpg" },
          { name: "La Hueca de Doña Mary - Cangrejada", img: "https://upload.wikimedia.org/wikipedia/commons/6/64/Cangrejada.jpg" },
          { name: "Sabores de El Paisa - Viche", img: "https://upload.wikimedia.org/wikipedia/commons/8/88/Viche_Chonero.jpg" }
        ],
        'Postres': [
          { name: "Don Rosita - Helados", img: "https://upload.wikimedia.org/wikipedia/commons/5/54/Helado_de_paila_02.jpg" },
          { name: "Doña Jorgito - Espumilla", img: "https://upload.wikimedia.org/wikipedia/commons/d/dc/Gelatinas%2C_manzana_y_espumilla.JPG" },
          { name: "El Palacio de Mama Miche - Higos", img: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Beautiful_decorated_cake_with_figs_and_blueberry_from_above._%2849574602871%29.jpg" },
          { name: "La Casa de El Gato - Quesadillas", img: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Dulces_t%C3%ADpicos_de_Gualaceo.jpg" },
          { name: "Los Agachaditos de Bolívar - Pristiños", img: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Pristi%C3%B1os_acompa%C3%B1ados_con_higos_con_queso_%28gastronom%C3%ADa_Ecuatoriana%29.jpg" }
        ]
      }
    };

    // 4. GENERAR OBJETOS MONGODB
    const generatedHuecas = [];

    // Recorremos Sector por Sector
    for (const [sectorName, categories] of Object.entries(database)) {
      // Recorremos Categoría por Categoría
      for (const [cuisineName, restaurants] of Object.entries(categories)) {
        // Recorremos los 5 restaurantes
        restaurants.forEach((item, index) => {
          
          // Generar coordenadas con variación ligera (Jitter) para mapas
          const latJitter = (index * 0.002) - 0.005;
          const lngJitter = (index * 0.002) - 0.005;

          const hueca = {
            name: item.name,
            description: `Deliciosa comida ${cuisineName.toLowerCase()} en el sector ${sectorName}. ${item.name.split('-')[1]} de la mejor calidad.`,
            address: `Calle Principal N${10 + index} y Transversal, ${sectorName}`,
            cuisine: cuisineName,
            image: item.img,
            location: {
              sector: sectorName,
              coordinates: {
                lat: baseCoords[sectorName].lat + latJitter,
                lng: baseCoords[sectorName].lng + lngJitter
              }
            },
            // Rating fijo para pruebas (variado pero consistente)
            rating: 3.5 + (index * 0.3), 
            totalRatings: 15 + (index * 10),
            createdAt: new Date()
          };

          generatedHuecas.push(hueca);
        });
      }
    }

    // 5. INSERTAR EN MONGO
    const created = await Restaurant.insertMany(generatedHuecas);

    res.json({ 
      message: '¡80 Huecas curadas creadas con éxito!', 
      total: created.length 
    });

  } catch (error) {
    console.error('Error seeding:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🍽️  Core service running on port ${PORT}`);
});
