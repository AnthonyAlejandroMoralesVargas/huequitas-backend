const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3003;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/huequitas_chat_db";

// --- CORRECCIÓN AQUÍ ---
// Definimos la URL permitida (tomada del .env o la IP directa)
const CLIENT_URL = process.env.CLIENT_URL || "http://100.53.153.178";
const ALLOWED_ORIGINS = [
  CLIENT_URL, // La variable del servidor (http://100.53.153.178)
  "http://100.53.153.178", // La IP explícita (por seguridad)
  "http://localhost:5173", // Para desarrollo local
  "http://localhost:5174",
  "http://localhost:5175",
];

// Configuración de Socket.IO con los nuevos orígenes
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS, // Usamos la lista nueva
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware Express (También actualizamos el CORS aquí)
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);

app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Chat Service: Connected to MongoDB"))
  .catch((err) =>
    console.error("❌ Chat Service: MongoDB connection error:", err),
  );

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "chat-service" });
});

// GET /messages - Get message history
app.get("/messages", async (req, res) => {
  try {
    const { room = "general", limit = 50 } = req.query;
    const messages = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .exec();

    res.json(messages.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`👤 User connected: ${socket.id}`);

  // Join a room
  socket.on("join-room", async (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);

    // Send recent messages from this room
    try {
      const messages = await Message.find({ room })
        .sort({ createdAt: -1 })
        .limit(50)
        .exec();

      socket.emit("message-history", messages.reverse());
    } catch (error) {
      console.error("Error fetching message history:", error);
    }
  });

  // Handle new message
  socket.on("send-message", async (data) => {
    try {
      const { userId, userName, message, room = "general" } = data;

      if (!userId || !userName || !message) {
        socket.emit("error", { message: "Missing required fields" });
        return;
      }

      // Save message to database
      const newMessage = new Message({
        userId,
        userName,
        message,
        room,
      });

      await newMessage.save();

      // Broadcast message to all users in the room
      io.to(room).emit("receive-message", {
        id: newMessage._id,
        userId: newMessage.userId,
        userName: newMessage.userName,
        message: newMessage.message,
        room: newMessage.room,
        createdAt: newMessage.createdAt,
      });
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`👋 User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`💬 Chat service running on port ${PORT}`);
});
