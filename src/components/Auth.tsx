import React, { useState } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';

interface AuthProps {
  onLogin: () => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setMessage('A verification email has been sent. Please check your inbox.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      setError(err.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('A password reset link has been sent to your email.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during password reset.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-3xl font-extrabold text-center text-indigo-400">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-bold text-gray-400 block"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 mt-1 text-gray-200 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-sm font-bold text-gray-400 block"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 mt-1 text-gray-200 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          >
            {isSignUp ? 'Sign Up' : 'Login'}
          </button>
        </form>
        {error && <p className="text-red-400 text-center">{error}</p>}
        {message && <p className="text-green-400 text-center">{message}</p>}
        <div className="text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-indigo-400 hover:underline"
          >
            {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
          </button>
        </div>
        <div className="text-center">
          <button
            onClick={handlePasswordReset}
            className="text-sm text-indigo-400 hover:underline"
          >
            Forgot Password?
          </button>
        </div>
        <div className="text-center">
          <button
            onClick={onLogin}
            className="text-sm text-gray-400 hover:underline"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
