import { GridItem } from "../types";
import { db } from "../config/firebase"; // Importamos la instancia de Firestore

// Definimos interfaces para tipar los datos que vienen de Firestore
interface RestaurantDoc {
    address: string;
    imageURL: string;
    name: string;
    phone: string;
    rating: number;
}

interface DishDoc {
    category: string;
    description: string;
    enable: boolean;
    imageURL: string;
    name: string;
    price: number;
    nutrition?: {
        calories: number;
        // otros campos nutricionales si los necesitas
    };
}

export const getRestaurants = async (): Promise<GridItem[]> => {
    console.log("🔍 Repo: Buscando Restaurantes en Firestore...");
    
    try {
        const snapshot = await db.collection('restaurants').get();
        
        const items: GridItem[] = snapshot.docs.map(doc => {
            const data = doc.data() as RestaurantDoc;
            
            return {
                id: doc.id,
                title: data.name,
                // Formateamos el subtítulo con Dirección y Rating
                subtitle: `${data.address} • ⭐ ${data.rating}`,
                // Mapeamos imageURL a imageSeed (El frontend deberá manejar esto, ver nota abajo*)
                imageSeed: data.imageURL, 
                type: 'restaurant'
            };
        });

        return items;

    } catch (error) {
        console.error("Error fetching restaurants:", error);
        return [];
    }
};

export const getDishes = async (restaurantId: string): Promise<GridItem[]> => {
    console.log(`🔍 Repo: Buscando Platos para Restaurante: ${restaurantId}`);

    try {
        const snapshot = await db.collection('restaurants')
            .doc(restaurantId)
            .collection('dishes')
            .where('enable', '==', true) // Solo traemos platos habilitados
            .get();

        const items: GridItem[] = snapshot.docs.map(doc => {
            const data = doc.data() as DishDoc;

            return {
                id: doc.id,
                title: data.name,
                // Formateamos subtítulo con Precio y Descripción corta
                subtitle: `$${data.price} • ${data.description.substring(0, 30)}${data.description.length > 30 ? '...' : ''}`,
                imageSeed: data.imageURL,
                type: 'dish'
            };
        });

        return items;

    } catch (error) {
        console.error(`Error fetching dishes for ${restaurantId}:`, error);
        return [];
    }
};