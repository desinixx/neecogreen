import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

window.currentUser = null;

const authService = {
    // Signup Function
    async signup(name, email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                createdAt: new Date().toISOString()
            });

            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Login Function
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Logout Function
    async logout() {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Check if logged in
    isLoggedIn() {
        return !!window.currentUser;
    }
};

// Expose to window for global access
window.authService = authService;

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    window.currentUser = user;
    updateAuthUI(user);
    
    // If on checkout page and user logs out, redirect to home
    if (!user && window.router && window.router.currentPage === 'checkout') {
        window.router.navigate('home');
    }
});

// UI Update Function (Will be defined/enhanced in index.html but basic toggle here)
function updateAuthUI(user) {
    const loginBtn = document.getElementById('nav-login-btn');
    const profileDropdown = document.getElementById('nav-profile-dropdown');
    
    if (user) {
        if(loginBtn) loginBtn.classList.add('hidden');
        if(profileDropdown) profileDropdown.classList.remove('hidden');
        // Fetch user name if needed, but for now we rely on the state
    } else {
        if(loginBtn) loginBtn.classList.remove('hidden');
        if(profileDropdown) profileDropdown.classList.add('hidden');
    }
}
