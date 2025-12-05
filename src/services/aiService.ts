// src/services/aiService.ts
import { GoogleGenerativeAI, FunctionDeclarationsTool, Content, GenerativeModel } from "@google/generative-ai";
import { ChatResponse } from "../types";
import { mcpTools } from "../mcp/tools";
import { zodToGeminiParameters } from "../utils/zodHelper"; // Necesitaremos un pequeño helper (ver abajo)

// Convertimos nuestras herramientas MCP al formato de Google Gemini
const googleTools: FunctionDeclarationsTool[] = [{
    functionDeclarations: mcpTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: zodToGeminiParameters(tool.parameters) // Helper para convertir Zod a JSON Schema
    }))
}];

const SYSTEM_INSTRUCTION = `
Eres el mesero virtual de ServyApp. Tu tono es amable, eficiente y breve.
Usa SIEMPRE las herramientas proporcionadas para obtener información.
No inventes platos ni precios.
Si el usuario selecciona un restaurante, usa 'select_restaurant'.
Si el usuario pide un plato, usa 'add_dish_to_cart'.
Si el usuario quiere pagar o ver la cuenta, usa 'finalize_order'.
`;

let modelInstance: GenerativeModel | null = null;

const getModel = () => {
    if (!modelInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key faltante");
        const genAI = new GoogleGenerativeAI(apiKey);
        modelInstance = genAI.getGenerativeModel({ model: "gemini-2.5-flash", tools: googleTools });
    }
    return modelInstance;
};

export const processUserRequest = async (userMessage: string, rawHistory: any[]): Promise<ChatResponse> => {
    const model = getModel();
    
    // Historial
    const history: Content[] = rawHistory.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
    }));

    const chat = model.startChat({
        history,
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_INSTRUCTION }] }
    });

    try {
        const result = await chat.sendMessage(userMessage);
        const calls = result.response.functionCalls();
        
        let uiData = null;
        let aiText = result.response.text();

        if (calls) {
            for (const call of calls) {
                // Buscamos la herramienta MCP correspondiente
                const tool = mcpTools.find(t => t.name === call.name);
                
                if (tool) {
                    console.log(`🔧 Ejecutando herramienta: ${tool.name}`, call.args);
                    
                    // Ejecutamos la lógica del "Handler"
                    const executionResult = await tool.handler(call.args as any);
                    
                    // Actualizamos UI Data si la herramienta devolvió algo
                    if (executionResult.uiData) uiData = executionResult.uiData;

                    // Le damos el resultado a Gemini para que genere la respuesta final hablada
                    const toolResponsePart = [{
                        functionResponse: {
                            name: call.name,
                            response: { result: executionResult.textContext } 
                        }
                    }];
                    
                    const finalResponse = await chat.sendMessage(toolResponsePart);
                    aiText = finalResponse.response.text();
                }
            }
        }

        return { aiMessage: aiText, screenData: uiData as unknown as ChatResponse['screenData'] };

    } catch (e) {
        console.error(e);
        return { aiMessage: "Lo siento, hubo un error técnico.", screenData: null };
    }
};