import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const dbService = {
    // Save Order
    async saveOrder(orderData) {
        try {
            const docRef = await addDoc(collection(db, "orders"), {
                ...orderData,
                status: 'placed', // Default status: placed, processing, shipped, delivered
                createdAt: new Date().toISOString()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error("Error adding document: ", error);
            return { success: false, error: error.message };
        }
    },

    // Get User Orders
    async getUserOrders(userId) {
        try {
            const q = query(
                collection(db, "orders"), 
                where("user_id", "==", userId)
                // Note: Indexing might be required for compound queries like where + orderBy
                // For now we will sort client side if needed or just fetch simple
            );
            
            const querySnapshot = await getDocs(q);
            const orders = [];
            querySnapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            
            // Client-side sort by date descending
            orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            return { success: true, orders };
        } catch (error) {
            console.error("Error fetching orders: ", error);
            return { success: false, error: error.message };
        }
    }
};

window.dbService = dbService;
