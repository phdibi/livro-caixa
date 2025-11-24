
import React, { useState } from 'react';
import { 
    signInWithPopup, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { SparklesIcon } from './Icons';

const Login: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        if (isRegistering) {
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (err: any) {
        console.error("Erro Auth:", err);
        let msg = "Ocorreu um erro. Tente novamente.";
        
        if (err.code === 'auth/invalid-email') msg = "E-mail inválido.";
        else if (err.code === 'auth/user-disabled') msg = "Usuário desativado.";
        else if (err.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
        else if (err.code === 'auth/wrong-password') msg = "Senha incorreta.";
        else if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está cadastrado.";
        else if (err.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
        else if (err.code === 'auth/operation-not-allowed') msg = "Login por E-mail/Senha não ativado no Firebase Console.";
        else if (err.code === 'auth/network-request-failed') msg = "Erro de conexão. Verifique sua internet.";
        
        setError(msg);
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Erro Google:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setError('O domínio deste site não está autorizado no Firebase. Use E-mail e Senha.');
      } else {
        setError(error.message);
      }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-indigo-600 dark:text-indigo-400 flex justify-center">
            <SparklesIcon className="w-12 h-12" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            {isRegistering ? 'Criar Conta' : 'Acessar Sistema'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Livro Caixa Inteligente
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleEmailAuth}>
          {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
                  <span className="block sm:inline">{error}</span>
              </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Endereço de Email</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Endereço de Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            >
              {loading ? 'Processando...' : (isRegistering ? 'Cadastrar' : 'Entrar')}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
            <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
                {isRegistering ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Cadastre-se'}
            </button>
        </div>

        <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Opções alternativas</span>
            </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
             <button
                onClick={handleGoogleLogin}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
            >
               Tentar com Google
            </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
