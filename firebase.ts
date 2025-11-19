
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBJBXLdJqFeVGiHErLj4_n8PJlRYVMCMQ4",
  authDomain: "livro-caixa-a9938.firebaseapp.com",
  projectId: "livro-caixa-a9938",
  storageBucket: "livro-caixa-a9938.firebasestorage.app",
  messagingSenderId: "842130849212",
  appId: "1:842130849212:web:926a45823a8f247ecbbfb9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
