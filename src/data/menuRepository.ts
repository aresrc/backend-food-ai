import { GridItem } from "../types";

/* ==============================================================================
  SECCIÓN FIREBASE (COMENTADA)
  Descomenta y configura esto cuando tengas tus credenciales de servicio.
==============================================================================
*/

// import * as admin from 'firebase-admin';
// import { getFirestore } from 'firebase-admin/firestore';

// // Asegúrate de tener tu serviceAccountKey.json
// // admin.initializeApp({
// //   credential: admin.credential.cert(require('../../serviceAccountKey.json'))
// // });

// const db = getFirestore();
// const CACHE_TTL = 60 * 1000; // 1 minuto de caché simple si quisieras



// --- DATOS ESTÁTICOS (FALLBACK ACTUAL) ---

const DATABASE = {
  restaurants: [
    { id: 'r1', title: 'La Trattoria Romana', subtitle: 'Italiana • ⭐ 4.8', imageSeed: 'italian-building', type: 'restaurant' },
    { id: 'r2', title: 'Sushi Zen Master', subtitle: 'Japonesa • ⭐ 4.9', imageSeed: 'sushi-chef', type: 'restaurant' },
    { id: 'r3', title: 'El Fuego Grill', subtitle: 'Carnes • ⭐ 4.7', imageSeed: 'grill-fire', type: 'restaurant' },
    { id: 'r4', title: 'Green Bowl Vida', subtitle: 'Vegana • ⭐ 4.6', imageSeed: 'green-salad', type: 'restaurant' }
  ] as GridItem[],
  
  categories: {
    'r1': [
      { id: 'c_r1_1', title: 'Pastas Caseras', subtitle: 'Hechas a mano', imageSeed: 'pasta-plate', type: 'category' },
      { id: 'c_r1_2', title: 'Pizzas Artesanales', subtitle: 'Horno de leña', imageSeed: 'pizza-oven', type: 'category' },
    ],
    'r2': [
        { id: 'c_r2_1', title: 'Rolls Especiales', subtitle: 'Fusión única', imageSeed: 'sushi-roll', type: 'category' },
    ]
    // ... puedes agregar más estáticos si quieres probar
  } as Record<string, GridItem[]>
};


// --- FUNCIONES DEL REPOSITORIO ---

export const getRestaurants = async (): Promise<GridItem[]> => {
    console.log("🔍 Buscando Restaurantes...");

    /* // --- IMPLEMENTACIÓN FIREBASE ---
    try {
        const snapshot = await db.collection('restaurants').get();
        if (snapshot.empty) return [];
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().name,       // Asegúrate que coincida con tu DB
            subtitle: doc.data().rating + ' • ' + doc.data().cuisine,
            imageSeed: doc.data().imageName,
            type: 'restaurant'
        })) as GridItem[];
    } catch (error) {
        console.error("Firebase Error:", error);
        return DATABASE.restaurants; // Fallback a estático en caso de error
    }
    */

    // Retorno Estático
    return DATABASE.restaurants;
};

export const getCategories = async (restaurantId: string): Promise<GridItem[]> => {
    console.log(`🔍 Buscando Categorías para: ${restaurantId}`);

    /* // --- IMPLEMENTACIÓN FIREBASE ---
    try {
        // Asumiendo estructura: collection('restaurants') -> doc -> collection('categories')
        const snapshot = await db.collection('restaurants').doc(restaurantId).collection('categories').get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            subtitle: doc.data().description,
            imageSeed: doc.data().imageName,
            type: 'category'
        })) as GridItem[];
    } catch (error) {
        console.error("Firebase Error:", error);
        return [];
    }
    */

    return DATABASE.categories[restaurantId] || [];
};

export const getDishes = async (categoryId: string): Promise<GridItem[]> => {
    console.log(`🔍 Generando/Buscando Platos para: ${categoryId}`);

    /* // --- IMPLEMENTACIÓN FIREBASE ---
    // Podrías hacer una query simple buscando por campo categoryId si no usas subcolecciones profundas
    try {
        const snapshot = await db.collection('dishes').where('categoryId', '==', categoryId).get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().name,
            subtitle: `$${doc.data().price}`,
            imageSeed: doc.data().imageName,
            type: 'dish'
        })) as GridItem[];
    } catch (e) { return [] }
    */

    // Lógica estática determinista (para demo)
    return [
        { id: `d_${categoryId}_1`, title: `Especialidad Chef`, subtitle: '$18.00', imageSeed: `dish-${categoryId}-1`, type: 'dish' },
        { id: `d_${categoryId}_2`, title: `Opción Clásica`, subtitle: '$14.50', imageSeed: `dish-${categoryId}-2`, type: 'dish' },
        { id: `d_${categoryId}_3`, title: `Opción Ligera`, subtitle: '$12.00', imageSeed: `dish-${categoryId}-3`, type: 'dish' },
    ];
};