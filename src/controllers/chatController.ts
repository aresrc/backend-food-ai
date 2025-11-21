import { Router, Request, Response } from 'express';
import { processUserRequest } from '../services/aiService';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { message, history } = req.body;

        if (!message) {
             res.status(400).json({ error: 'Message is required' });
             return;
        }

        console.log(`📨 Mensaje recibido: "${message}"`);

        const response = await processUserRequest(message, history || []);

        res.json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;