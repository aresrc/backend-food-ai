import { GoogleGenerativeAI, FunctionDeclarationsTool, Part, SchemaType, Content, GenerativeModel } from "@google/generative-ai";
import * as repo from "../data/menuRepository";
import { ChatResponse, GridItem } from "../types";

interface GetMenuDataArgs {
    queryType: "restaurants" | "categories" | "dishes";
    parentId?: string;
}

// Definición de herramientas para la IA
const tools: FunctionDeclarationsTool[] = [
  {
    functionDeclarations: [
      {
        name: "getMenuData",
        description: "Obtiene la lista de restaurantes, categorías o platillos disponibles.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            queryType: { 
                type: SchemaType.STRING, 
                enum: ["restaurants", "categories", "dishes"],
                format: "enum",
                description: "El tipo de información que el usuario busca."
            },
            parentId: { 
                type: SchemaType.STRING,
                description: "El ID del padre (ID del restaurante para buscar categorías, ID de categoría para platos)."
            }
          },
          required: ["queryType"]
        }
      }
    ]
  }
];

// --- CORRECCIÓN: INICIALIZACIÓN PEREZOSA (LAZY) ---
// No inicializamos 'genAI' aquí arriba para evitar problemas con dotenv.
let modelInstance: GenerativeModel | null = null;

const getModel = (): GenerativeModel => {
    // Solo inicializamos si aún no existe la instancia
    if (!modelInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("❌ CRITICAL ERROR: GEMINI_API_KEY no encontrada. Asegúrate de tener el archivo .env en la raíz y que contenga la clave.");
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        modelInstance = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite",
            tools: tools
        });
    }
    return modelInstance;
};

export const processUserRequest = async (userMessage: string, rawHistory: any[]): Promise<ChatResponse> => {

    // Obtenemos el modelo (ahora es seguro porque dotenv ya corrió en index.ts)
    let model: GenerativeModel;
    try {
        model = getModel();
    } catch (e: any) {
        console.error(e.message);
        return { aiMessage: "Error de configuración del servidor (API Key faltante).", screenData: null };
    }

    // Transformar historial simple al formato de Gemini
    const formattedHistory: Content[] = rawHistory.map(item => {
        if (item.parts) return item;
        return {
            role: item.role,
            parts: [{ text: item.text }]
        };
    });

    const chatSession = model.startChat({
        history: formattedHistory,
        systemInstruction: { 
            role: "system", 
            parts: [{ text: `
                Eres un camarero virtual energético y servicial.
                Tu trabajo es ayudar al usuario a navegar el menú.
                
                REGLAS:
                1. NO inventes platos ni restaurantes. Usa la herramienta 'getMenuData' para saber qué existe.
                2. Si llamas a una herramienta, usa la información que te devuelve para responder al usuario.
                3. Sé breve. El usuario te está escuchando en una app móvil.
                4. Si el usuario saluda, responde amablemente y ofrece mostrar los restaurantes.
            `}] 
        }
    });

    try {
        const result = await chatSession.sendMessage(userMessage);
        const response = result.response;
        
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
             throw new Error("No se generaron candidatos de respuesta.");
        }

        const toolCalls = candidates[0].content.parts.filter(part => !!part.functionCall);

        let uiData = null;
        let finalAiText = "";

        if (toolCalls && toolCalls.length > 0) {
            const call = toolCalls[0].functionCall;

            if (call && call.name === "getMenuData" && call.args) {
                const { queryType, parentId } = call.args as unknown as GetMenuDataArgs;

                console.log(`🤖 AI Tool Call: ${queryType}, parent: ${parentId}`);

                let items: GridItem[] = [];
                if (queryType === 'restaurants') items = await repo.getRestaurants();
                else if (queryType === 'categories' && parentId) items = await repo.getCategories(parentId);
                else if (queryType === 'dishes' && parentId) items = await repo.getDishes(parentId);

                uiData = {
                    phase: queryType,
                    items: items
                };
                
                const toolResponsePart: Part = {
                    functionResponse: {
                        name: "getMenuData",
                        response: { name: "getMenuData", content: { result: items } }
                    }
                };

                const functionResponse = await chatSession.sendMessage([toolResponsePart]);
                finalAiText = functionResponse.response.text();
            }
        } else {
            finalAiText = response.text();
        }

        return {
            aiMessage: finalAiText,
            screenData: uiData
        };

    } catch (error) {
        console.error("Error en AI Service:", error);
        return {
            aiMessage: "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?",
            screenData: null
        };
    }
};