import { GoogleGenerativeAI, FunctionDeclarationsTool, Part, SchemaType, Content, GenerativeModel } from "@google/generative-ai";
import * as repo from "../data/menuRepository";
import { ChatResponse, GridItem } from "../types";

interface GetMenuDataArgs {
    queryType: "restaurants" | "dishes";
    parentId?: string;
}

interface AddToOrderArgs {
    dishName: string;
    quantity: number;
    observation?: string;
}

interface CompleteOrderArgs {
    finalMessage: string;
}

const tools: FunctionDeclarationsTool[] = [
  {
    functionDeclarations: [
      {
        name: "getMenuData",
        description: "Obtiene datos del menú. Úsalo para mostrar restaurantes o platos.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            queryType: { type: SchemaType.STRING, format: "enum", enum: ["restaurants", "dishes"] },
            parentId: { type: SchemaType.STRING, description: "ID del restaurante (requerido para dishes)" }
          },
          required: ["queryType"]
        }
      },
      {
        name: "addToOrder",
        description: "Agrega un item al pedido o incrementa su cantidad.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            dishName: { type: SchemaType.STRING },
            quantity: { type: SchemaType.NUMBER },
            observation: { type: SchemaType.STRING }
          },
          required: ["dishName"]
        }
      },
      {
        name: "completeOrder",
        description: "Finaliza la interacción y muestra el resumen del pedido (pantalla final).",
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
            model: "gemini-2.5-flash-lite",
            tools: tools
        });
    }
    return modelInstance;
};

// --- PROMPT MAESTRO: FLUJO "PROCESO COMÚN" ---
const SYSTEM_INSTRUCTION_TEXT = `
ROL: Eres "ServyApp", un asistente de camarero digital eficiente y amable.

OBJETIVO: Guiar al usuario por este flujo exacto:
1. Seleccionar Restaurante.
2. Explorar Platos (Verbalizar pocos a la vez).
3. Añadir al pedido (Confirmar y seguir mostrando el menú).
4. Finalizar (Mostrar resumen y dar instrucciones QR).

REGLAS DE COMPORTAMIENTO (Script):

A. AL INICIAR / SALUDAR:
   - Llama a \`getMenuData(queryType="restaurants")\`.
   - Di: "Hola, te presento los siguientes restaurantes disponibles."

B. AL SELECCIONAR RESTAURANTE (ej. "Qué hay en Sushi Zen?"):
   - Llama a \`getMenuData(queryType="dishes", parentId="ID_DETECTADO")\`.
   - MUESTRA visualmente todos los platos.
   - VERBALMENTE: "Claro, en [Nombre] hay platillos como [Nombra SOLO 4 platos] y otros más. ¿Le gustaría pedir alguno?"

C. SI EL USUARIO PREGUNTA "¿QUÉ MÁS HAY?":
   - NO llames a la herramienta de nuevo (ya tienes los datos).
   - VERBALMENTE: "Hay estos otros platos en [Nombre]: [Nombra 3 o 4 platos QUE NO HAYAS DICHO ANTES]."

D. AL PEDIR UN PLATO (ej. "Deseo un Ramen"):
   - Llama a \`addToOrder(dishName="Ramen", quantity=1)\`.
   - Si el usuario dice "dame dos más", calcula la cantidad total o suma.
   - ESTADO VISUAL: Debes volver a llamar a \`getMenuData("dishes")\` (o mantener el estado visual de los platos) para que el usuario pueda pedir más cosas. NO muestres el resumen final todavía.
   - VERBALMENTE: "Genial, lo he añadido a tu pedido. ¿Deseas algo más?"

E. AL FINALIZAR (ej. "Eso sería todo"):
   - Llama a \`completeOrder\`.
   - VERBALMENTE: "Perfecto, he generado tu pedido. Ve a la sección de 'Mi Orden' para escanear el QR en el local."

F. SI MODIFICA AL FINAL (ej. estando en el resumen dice "Agrega uno más"):
   - Llama a \`addToOrder\`.
   - Inmediatamente llama a \`completeOrder\` para refrescar el resumen visual.
   - VERBALMENTE: "Perfecto, lo he agregado. Puede ir a la sección 'Mi Orden' para escanear el QR."

NOTA: Nunca inventes platos. Usa estrictamente lo que devuelve \`getMenuData\`.
`;

export const processUserRequest = async (userMessage: string, rawHistory: any[]): Promise<ChatResponse> => {
    let model: GenerativeModel;
    try {
        model = getModel();
    } catch (e: any) {
        return { aiMessage: "Error API Key.", screenData: null };
    }

    const formattedHistory: Content[] = rawHistory.map(item => {
        if (item.parts) return item;
        return { role: item.role, parts: [{ text: item.text }] };
    });

    const chatSession = model.startChat({
        history: formattedHistory,
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_INSTRUCTION_TEXT }] }
    });

    try {
        const result = await chatSession.sendMessage(userMessage);
        const response = result.response;
        const candidates = response.candidates;

        if (!candidates || candidates.length === 0) throw new Error("No candidates");

        const toolCalls = candidates[0].content.parts.filter(part => !!part.functionCall);

        let uiData = null;
        let finalAiText = response.text();

        if (toolCalls && toolCalls.length > 0) {
            // Manejamos llamadas múltiples (ej: addToOrder + getMenuData en la misma vuelta)
            for (const part of toolCalls) {
                const call = part.functionCall!;
                let functionResult: any = { result: "ok" };

                // 1. NAVEGACIÓN
                if (call.name === "getMenuData") {
                    const args = call.args as unknown as GetMenuDataArgs;
                    console.log(`🤖 Nav: ${args.queryType}`);
                    
                    let items: GridItem[] = [];
                    if (args.queryType === 'restaurants') items = await repo.getRestaurants();
                    else if (args.queryType === 'dishes' && args.parentId) items = await repo.getDishes(args.parentId);
                    
                    // Asignamos a uiData para enviar al frontend
                    uiData = { phase: args.queryType, items: items };
                    functionResult = { result: items };
                }
                
                // 2. PEDIDO
                else if (call.name === "addToOrder") {
                    const args = call.args as unknown as AddToOrderArgs;
                    console.log(`🛒 Add: ${args.quantity}x ${args.dishName}`);
                    // Aquí iría lógica de DB real
                    uiData = { phase: 'summary', items: [] }; // Phase summary activa OrderSummary en frontend
                    functionResult = { message: `Añadido ${args.quantity} ${args.dishName}` };
                }

                // 3. FINALIZAR
                else if (call.name === "completeOrder") {
                    console.log("🏁 Finalizando orden");
                    uiData = { phase: 'summary', items: [] }; // Phase summary activa OrderSummary en frontend
                    functionResult = { status: "Order finalized" };
                }

                // Enviamos la respuesta de la herramienta a la IA para que genere el texto final
                const toolResponsePart: Part = {
                    functionResponse: {
                        name: call.name,
                        response: { name: call.name, content: functionResult }
                    }
                };
                
                // Solo enviamos mensaje a la IA si necesitamos texto (generalmente la última herramienta define el texto)
                const functionResponse = await chatSession.sendMessage([toolResponsePart]);
                finalAiText = functionResponse.response.text();
            }
        }

        return {
            aiMessage: finalAiText,
            screenData: uiData
        };

    } catch (error) {
        console.error("Error AI:", error);
        return { aiMessage: "Hubo un error técnico. Intenta de nuevo.", screenData: null };
    }
};