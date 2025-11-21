import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './controllers/chatController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', chatRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('🤖 Voice Food AI Backend is running with Gemini 1.5 Flash');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if(!process.env.GEMINI_API_KEY) {
        console.warn("⚠️ WARNING: GEMINI_API_KEY is not set in .env file");
    }
});