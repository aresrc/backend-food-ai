// src/utils/zodHelper.ts
import { z } from "zod";

export function zodToGeminiParameters(zodSchema: z.ZodObject<any>): any {
    // Esta es una simplificación. Para producción usa 'zod-to-json-schema'
    // npm install zod-to-json-schema
    const shape = zodSchema.shape;
    const properties: any = {};
    const required: string[] = [];

    for (const key in shape) {
        const field = shape[key];
        properties[key] = {
            type: field instanceof z.ZodNumber ? "number" : "string",
            description: field.description
        };
        if (!field.isOptional()) {
            required.push(key);
        }
    }

    return {
        type: "object",
        properties,
        required
    };
}