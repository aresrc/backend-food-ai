import { GoogleGenerativeAI, FunctionDeclarationsTool, Part, SchemaType, Content, GenerativeModel } from "@google/generative-ai";
import * as repo from "../data/menuRepository";
import { ChatResponse, GridItem } from "../types";

// Definición de tipos para los argumentos de las herramientas
interface GetMenuDataArgs {
    queryType: "restaurants" | "dishes";
    parentId?: string;
}

interface AddToOrderArgs {
    title: string;
    quantity: number;
}

interface CompleteOrderArgs {
    finalMessage: string;
}

// 1. DEFINICIÓN DE HERRAMIENTAS (Idéntico a la lógica simple de webservybackend)
const tools: FunctionDeclarationsTool[] = [
  {
    functionDeclarations: [
      {
        name: "getMenuData",
        description: "Recupera la lista de restaurantes o platos de la base de datos.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            queryType: { type: SchemaType.STRING, format: "enum", enum: ["restaurants", "dishes"], description: "El tipo de datos a buscar." },
            parentId: { type: SchemaType.STRING, description: "El ID del item padre (ej. ID del restaurante al buscar platos)." }
          },
          required: ["queryType"]
        }
      },
      {
        name: "addToOrder",
        description: "Agrega un plato seleccionado al carrito de compras.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            quantity: { type: SchemaType.NUMBER }
          },
          required: ["title", "quantity"]
        }
      },
      {
        name: "completeOrder",
        description: "Finaliza la sesión y muestra el resumen.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            finalMessage: { type: SchemaType.STRING }
          },
          required: ["finalMessage"]
        }
      }
    ]
  }
];

let modelInstance: GenerativeModel | null = null;

const getModel = (): GenerativeModel => {
    if (!modelInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("❌ GEMINI_API_KEY no encontrada.");
        
        const genAI = new GoogleGenerativeAI(apiKey);
        modelInstance = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", // O el modelo que prefieras
            tools: tools
        });
    }
    return modelInstance;
};

// 2. SYSTEM INSTRUCTION (Adaptado de geminiLive.ts)
// Forzamos al modelo a seguir el bucle: Obtener Datos -> Actualizar UI -> Hablar
const SYSTEM_INSTRUCTION_TEXT = `
ROLE: Eres el anfitrión energético de una app de pedidos de comida por voz "ServyApp".

**INSTRUCCIÓN DE DATOS CRÍTICA:**
1. Tú **NO** conoces el menú de memoria. NO tienes conocimiento interno.
2. **DEBES** usar la herramienta \`getMenuData\` para averiguar qué está disponible.
3. **NUNCA** inventes opciones. Solo habla y muestra lo que \`getMenuData\` devuelve.

**BUCLE DE COMPORTAMIENTO ESTRICTO:**

1. **AL INICIAR (SALUDO)**:
   - **Paso A**: Llama inmediatamente a \`getMenuData(queryType="restaurants")\`.
   - **Paso B**: Usa la información devuelta para hablar: "¡Bienvenido! Aquí tienes nuestros restaurantes disponibles:" y **lee los nombres** de los restaurantes.

2. **EN NAVEGACIÓN (USUARIO SELECCIONA UN RESTAURANTE)**:
   - **Paso A**: Intenta usar el \`id\` exacto que recibiste en la lista anterior (ej. "iNz2DyhX..."). **IMPORTANTE** Si no estás seguro, usa el nombre exacto del restaurante.
   - **Paso B**: Llama a \`getMenuData(queryType="dishes", parentId="[RESTAURANT_ID]")\`.
   - **Paso C**: Habla: "Excelente elección. Aquí tienes el menú:" y **lee los nombres** de los platos destacados.

3. **EN PEDIDO**:
   - Si el usuario elige un plato, llama a \`addToOrder\`.
   - Pregunta si quieren algo más o finalizar.

4. **AL FINALIZAR**:
   - Llama a \`completeOrder\`.

**MANEJO DE ERRORES**:
Si \`getMenuData\` devuelve una lista vacía, di "Lo siento, no hay información disponible para esa selección."
`;

export const processUserRequest = async (userMessage: string, rawHistory: any[]): Promise<ChatResponse> => {
    let model: GenerativeModel;
    try {
        model = getModel();
    } catch (e: any) {
        return { aiMessage: "Error de configuración de API Key.", screenData: null };
    }

    // Formatear historial para la API de Node
    const formattedHistory: Content[] = rawHistory.map(item => {
        // Si ya viene formateado (ej. desde el frontend correctamente)
        if (item.parts && item.role) return item;
        // Si viene simple
        return { role: item.role, parts: [{ text: item.text }] };
    });

    const chatSession = model.startChat({
        history: formattedHistory,
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_INSTRUCTION_TEXT }] }
    });

    try {
        // Enviamos mensaje del usuario
        const result = await chatSession.sendMessage(userMessage);
        const response = result.response;
        const functionCalls = response.functionCalls();

        let uiData = null;
        let finalAiText = response.text(); // Texto inicial (si lo hay antes de la tool)

        // Si el modelo decide llamar herramientas
        if (functionCalls && functionCalls.length > 0) {
            
            // Vamos a procesar las llamadas y alimentar al modelo con las respuestas
            // para que genere el texto final.
            for (const call of functionCalls) {
                let functionResult: any = { result: "ok" };

                // --- Lógica de Herramientas ---
                
                if (call.name === "getMenuData") {
                    const args = call.args as unknown as GetMenuDataArgs;
                    console.log(`🤖 Nav: ${args.queryType} buscando: ${args.parentId || 'N/A'}`);
                    
                    let items: GridItem[] = [];
                    
                    if (args.queryType === 'restaurants') {
                        items = await repo.getRestaurants();
                    } 
                    else if (args.queryType === 'dishes' && args.parentId) {
                        // SOLUCIÓN: "Búsqueda Inteligente" del Restaurante
                        // 1. Traemos todos los restaurantes (es barato si son pocos)
                        const allRestaurants = await repo.getRestaurants();
                        
                        // 2. Buscamos el restaurante correcto comparando ID O Nombre
                        const targetRestaurant = allRestaurants.find(r => {
                            // A) Coincidencia exacta de ID (Caso ideal)
                            if (r.id === args.parentId) return true;

                            // B) Coincidencia de Nombre (Caso "alucinación" de la IA)
                            // Normalizamos para ignorar mayúsculas, espacios o guiones bajos
                            // Ej: "El Pez Dorado" hace match con "el_pez_dorado_id"
                            const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
                            
                            return normalize(r.title).includes(normalize(args.parentId!)) || 
                                normalize(args.parentId!).includes(normalize(r.title));
                        });

                        if (targetRestaurant) {
                            console.log(`✅ Restaurante encontrado: "${targetRestaurant.title}" (ID real: ${targetRestaurant.id})`);
                            // Usamos el ID REAL de Firebase para buscar los platos
                            items = await repo.getDishes(targetRestaurant.id);
                        } else {
                            console.warn(`❌ No se encontró restaurante para: ${args.parentId}`);
                            // Opcional: devolver items vacíos o un plato de error
                        }
                    }

                    uiData = { phase: args.queryType, items: items };
                    functionResult = items; 
                } 
                else if (call.name === "addToOrder") {
                    const args = call.args as unknown as AddToOrderArgs;
                    console.log(`🛒 Add: ${args.quantity}x ${args.title}`);
                    
                    // En un caso real, aquí guardaríamos en base de datos del carrito
                    // uiData null significa "no cambies la pantalla de platos"
                    functionResult = { message: `Añadido ${args.quantity} ${args.title} al pedido.` };
                } 
                else if (call.name === "completeOrder") {
                    const args = call.args as unknown as CompleteOrderArgs;
                    console.log("🏁 Finalizando orden");
                    
                    uiData = { phase: 'summary', items: [] };
                    functionResult = { status: "Order finalized" };
                }

                // --- Enviar respuesta de la herramienta de vuelta a Gemini ---
                // Esto es crucial: La IA necesita ver los datos (JSON) para poder leerlos al usuario
                const toolPart = [
                    {
                        functionResponse: {
                            name: call.name,
                            response: {
                                name: call.name,
                                content: functionResult
                            }
                        }
                    }
                ];

                const toolResponse = await chatSession.sendMessage(toolPart);
                // El texto final es lo que la IA dice DESPUÉS de ver los datos
                finalAiText = toolResponse.response.text();
            }
        }

        return {
            aiMessage: finalAiText,
            screenData: uiData
        };

    } catch (error) {
        console.error("Error AI Processing:", error);
        return { aiMessage: "Lo siento, tuve un problema procesando tu solicitud.", screenData: null };
    }
};