import { db } from "../config/firebase";
import { GridItem } from "../types";

export class SmartResolver {
    
    // Normaliza texto para comparaciones (quita tildes, mayúsculas, etc.)
    private static normalize(text: string): string {
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    /**
     * Busca un restaurante por nombre aproximado.
     */
    static async findRestaurantByName(queryName: string): Promise<GridItem | null> {
        const snapshot = await db.collection('restaurants').get();
        const normalizedQuery = this.normalize(queryName);

        const match = snapshot.docs.find(doc => {
            const data = doc.data();
            const name = this.normalize(data.name || "");
            return name.includes(normalizedQuery) || normalizedQuery.includes(name);
        });

        if (!match) return null;

        const data = match.data();
        return {
            id: match.id,
            title: data.name,
            subtitle: `${data.address} • ⭐ ${data.rating}`,
            imageSeed: data.imageURL,
            type: 'restaurant'
        };
    }

    /**
     * Busca un plato y devuelve TODOS sus datos crudos para que Android pueda construir el objeto.
     */
    static async findDishByName(restaurantId: string, dishName: string): Promise<any | null> {
        const normalizedQuery = this.normalize(dishName);
        
        // Obtenemos todos los platos habilitados del restaurante
        const snapshot = await db.collection('restaurants')
            .doc(restaurantId)
            .collection('dishes')
            .where('enable', '==', true)
            .get();

        const match = snapshot.docs.find(doc => {
            const data = doc.data();
            const name = this.normalize(data.name || "");
            return name.includes(normalizedQuery) || normalizedQuery.includes(name);
        });

        if (!match) return null;

        // Retornamos el objeto completo con ID
        return { id: match.id, ...match.data() };
    }
}