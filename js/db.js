import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    orderBy,
    doc,
    setDoc,
    getDoc,
    updateDoc
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
    },

    // Update User Cart
    async updateUserCart(userId, cart) {
        try {
            await setDoc(doc(db, "users", userId), { cart: cart }, { merge: true });
            return { success: true };
        } catch (error) {
            console.error("Error updating cart: ", error);
            return { success: false, error: error.message };
        }
    },

    // Get User Cart
    async getUserCart(userId) {
        try {
            const docRef = doc(db, "users", userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists() && docSnap.data().cart) {
                return { success: true, cart: docSnap.data().cart };
            } else {
                return { success: true, cart: [] };
            }
        } catch (error) {
            console.error("Error getting cart: ", error);
            return { success: false, error: error.message };
        }
    },

    // Update Order
    async updateOrder(orderId, updateData) {
        try {
            const docRef = doc(db, "orders", orderId);
            await updateDoc(docRef, updateData);
            return { success: true };
        } catch (error) {
            console.error("Error updating order: ", error);
            return { success: false, error: error.message };
        }
    }
};

window.dbService = dbService;
