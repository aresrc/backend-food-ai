// src/mcp/tools.ts
import { z } from "zod";
import * as repo from "../data/menuRepository";
import { SmartResolver } from "../utils/smartResolver";

// Definición de las herramientas disponibles para la IA
export const mcpTools = [
  {
    name: "navigate_restaurants",
    description: "Muestra la lista de restaurantes disponibles. Úsalo al inicio o cuando el usuario pida ver restaurantes.",
    parameters: z.object({}), // Sin parámetros
    handler: async () => {
        const items = await repo.getRestaurants();
        return {
            uiData: { phase: "restaurants", items: items },
            textContext: `Se encontraron ${items.length} restaurantes: ${items.map(i => i.title).join(", ")}.`
        };
    }
  },
  {
    name: "select_restaurant",
    description: "Selecciona un restaurante por su nombre (o ID si está disponible) y muestra su menú.",
    parameters: z.object({
        restaurantName: z.string().describe("El nombre del restaurante que el usuario mencionó")
    }),
    handler: async (args: { restaurantName: string }) => {
        // AQUÍ ESTÁ LA MAGIA: Resolvemos el ID basándonos en el nombre
        const restaurant = await SmartResolver.findRestaurantByName(args.restaurantName);
        
        if (!restaurant) {
            return {
                uiData: null,
                textContext: "Error: No se encontró ningún restaurante con ese nombre."
            };
        }

        const dishes = await repo.getDishes(restaurant.id);
        return {
            uiData: { phase: "dishes", items: dishes }, // Enviamos IDs reales al frontend
            textContext: `Menú de ${restaurant.title} cargado. Platos disponibles: ${dishes.map(d => d.title).join(", ")}.`
        };
    }
  },
  {
    // --- ESTA ES LA HERRAMIENTA CLAVE ---
    name: "add_dish_to_cart",
    description: "Agrega un plato al carrito. Requiere nombre del restaurante, nombre del plato y cantidad.",
    parameters: z.object({
        restaurantName: z.string().describe("Nombre del restaurante actual"),
        dishName: z.string().describe("Nombre del plato a agregar"),
        quantity: z.number().default(1)
    }),
    handler: async (args: { restaurantName: string, dishName: string, quantity: number }) => {
        // 1. Resolver IDs reales
        const restaurant = await SmartResolver.findRestaurantByName(args.restaurantName);
        if (!restaurant) return { uiData: null, textContext: "Error: Restaurante no identificado." };

        const dish = await SmartResolver.findDishByName(restaurant.id, args.dishName);
        if (!dish) return { uiData: null, textContext: `No encontré el plato ${args.dishName}.` };

        // 2. Construir el Payload para Android
        // Empaquetamos los datos extra en un JSON dentro de 'subtitle'
        // ya que VisualItem solo tiene campos de texto.
        const finalQuantity = args.quantity || 1;

        const metadata = {
            restaurantId: restaurant.id,
            quantity: args.quantity,
            price: dish.price,
            description: dish.description,
            category: dish.category || "General"
        };

        return {
            uiData: {
                phase: "ADD_TO_CART", // <--- SEÑAL PARA ANDROID
                items: [{
                    id: dish.id,
                    title: dish.name,
                    subtitle: JSON.stringify(metadata), // <--- DATA OCULTA
                    imageSeed: dish.imageURL,
                    type: "action_signal"
                }]
            },
            textContext: `Listo. Agregando ${args.quantity} ${dish.name} a tu orden.`
        };
    }
  },
  {
    name: "finalize_order",
    description: "Finaliza el pedido y muestra el resumen.",
    parameters: z.object({}),
    handler: async () => {
        return {
            uiData: { phase: "EXECUTE_ORDER", items: [] }, // El frontend maneja la vista de resumen
            textContext: "Excelente. Estoy enviando tu pedido a cocina ahora mismo."
        };
    }
  }
];