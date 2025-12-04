'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isLogin ? '/user/login' : '/user/register';
      const res = await api.post(endpoint, { email, password });
      
      if (isLogin) {
        localStorage.setItem('gj_token', res.data.token);
        router.push('/dashboard');
      } else {
        alert('Registration successful! Please login.');
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Styles matching the Dashboard (Light mode, heavy rounded corners)
  const inputStyle = "w-full bg-gray-50 text-[#1D1D1D] placeholder-gray-400 text-lg px-6 py-4 rounded-2xl border-none focus:outline-none focus:ring-2 focus:ring-[#FF6B4A] transition-all";

  return (
    <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center p-6 font-sans">
      
      <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-sm w-full max-w-md flex flex-col items-center text-center">
        
        {/* Minimal Brand Identifier */}
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-8">
           <span className="text-white text-2xl font-bold">X</span>
        </div>
        
        <h2 className="text-4xl font-bold text-[#1D1D1D] mb-3 tracking-tight">
          {isLogin ? 'Welcome Back' : 'Get Started'}
        </h2>
        
        <p className="text-gray-400 mb-10 text-sm font-medium">
          {isLogin ? 'Enter your details to access your dashboard.' : 'Create an account to track your store.'}
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div>
            <input
              type="email"
              required
              className={inputStyle}
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <input
              type="password"
              required
              className={inputStyle}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF6B4A] hover:bg-[#E05A3D] text-white font-bold text-lg py-4 rounded-full shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-gray-400 hover:text-black text-sm font-semibold transition-colors"
          >
            {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>

      </div>
    </div>
  );
}