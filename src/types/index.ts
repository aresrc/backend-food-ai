// Estos tipos coinciden con lo que espera tu UI en Jetpack Compose

export interface GridItem {
    id: string;
    title: string;
    subtitle: string;
    imageSeed: string;
    type: 'restaurant' | 'category' | 'dish';
}
  
export interface ChatRequest {
    message: string;       // Lo que dijo el usuario (convertido a texto en el móvil)
    history?: Content[];   // Historial de conversación previo (opcional)
}

export interface ChatResponse {
    aiMessage: string;     // Texto para que el móvil lo hable (TTS)
    screenData?: {         // Datos para actualizar la UI (LazyVerticalGrid)
        phase: string;
        items: GridItem[];
    } | null;
}

// Tipo simplificado para el historial de Gemini SDK
export interface Content {
    role: 'user' | 'model';
    parts: { text: string }[];
}