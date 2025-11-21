import { GridItem } from "../types";

// --- DATOS ESTÁTICOS ---
const DATABASE = {
  restaurants: [
    { id: 'r1', title: 'La Trattoria Romana', subtitle: 'Italiana • ⭐ 4.8', imageSeed: 'italian-building', type: 'restaurant' },
    { id: 'r2', title: 'Sushi Zen Master', subtitle: 'Japonesa • ⭐ 4.9', imageSeed: 'sushi-chef', type: 'restaurant' },
    { id: 'r3', title: 'El Fuego Grill', subtitle: 'Carnes • ⭐ 4.7', imageSeed: 'grill-fire', type: 'restaurant' },
    { id: 'r4', title: 'Green Bowl Vida', subtitle: 'Vegana • ⭐ 4.6', imageSeed: 'green-salad', type: 'restaurant' }
  ] as GridItem[]
};

export const getRestaurants = async (): Promise<GridItem[]> => {
    console.log("🔍 Repo: Buscando Restaurantes...");
    return DATABASE.restaurants;
};

export const getDishes = async (restaurantId: string): Promise<GridItem[]> => {
    console.log(`🔍 Repo: Buscando Platos para Restaurante: ${restaurantId}`);

    if (restaurantId === 'r1') { // Italiana
        return [
            { id: `d_r1_1`, title: `Spaghetti Carbonara`, subtitle: '$18.00 • Clásico romano', imageSeed: `pasta-carbonara`, type: 'dish' },
            { id: `d_r1_2`, title: `Pizza Margarita`, subtitle: '$15.00 • Horno de leña', imageSeed: `pizza-margherita`, type: 'dish' },
            { id: `d_r1_3`, title: `Lasagna de Carne`, subtitle: '$20.00 • Receta de la abuela', imageSeed: `lasagna`, type: 'dish' },
            { id: `d_r1_4`, title: `Tiramisu`, subtitle: '$10.00 • Postre casero', imageSeed: `tiramisu`, type: 'dish' },
        ];
    }
    
    if (restaurantId === 'r2') { // Japonesa - AMBIENTE EXTENDIDO PARA DEMO
        return [
            // Primer grupo (para la primera mención)
            { id: `d_r2_1`, title: `Dragon Roll`, subtitle: '$18.00 • Anguila y aguacate', imageSeed: `sushi-roll`, type: 'dish' },
            { id: `d_r2_2`, title: `Sashimi Mix`, subtitle: '$22.00 • Salmón y Atún fresco', imageSeed: `sashimi`, type: 'dish' },
            { id: `d_r2_3`, title: `Ramen Tonkotsu`, subtitle: '$16.00 • Caldo de 12 horas', imageSeed: `ramen`, type: 'dish' },
            { id: `d_r2_4`, title: `Gyozas`, subtitle: '$8.00 • Entrada (6 pz)', imageSeed: `gyoza`, type: 'dish' },
            // Segundo grupo (para el "¿Qué más hay?")
            { id: `d_r2_5`, title: `Ebi Tempura`, subtitle: '$14.00 • Langostinos fritos', imageSeed: `tempura`, type: 'dish' },
            { id: `d_r2_6`, title: `Miso Soup`, subtitle: '$5.00 • Sopa tradicional', imageSeed: `miso`, type: 'dish' },
            { id: `d_r2_7`, title: `Nigiri de Salmón`, subtitle: '$10.00 • 2 piezas', imageSeed: `nigiri`, type: 'dish' },
            { id: `d_r2_8`, title: `Yakitori`, subtitle: '$12.00 • Brochetas de pollo', imageSeed: `yakitori`, type: 'dish' },
        ];
    }

    // Fallback
    return [
        { id: `d_${restaurantId}_1`, title: `Especialidad de la Casa`, subtitle: '$18.00 • Recomendado', imageSeed: `dish-${restaurantId}-1`, type: 'dish' },
        { id: `d_${restaurantId}_2`, title: `Menú Ejecutivo`, subtitle: '$14.50 • Incluye bebida', imageSeed: `dish-${restaurantId}-2`, type: 'dish' },
        { id: `d_${restaurantId}_3`, title: `Opción Ligera`, subtitle: '$12.00 • Bajo en calorías', imageSeed: `dish-${restaurantId}-3`, type: 'dish' },
    ];
};