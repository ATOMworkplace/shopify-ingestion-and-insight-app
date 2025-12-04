import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'ngrok-skip-browser-warning': 'true', // Bypass ngrok warning page
  }
});

api.interceptors.request.use((config) => {
  console.log('[DEBUG] Axios Request Interceptor Triggered for:', config.url);
  
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gj_token');
    console.log('[DEBUG] Token in localStorage:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[DEBUG] Authorization header attached');
    } else {
      console.log('[DEBUG] No token found in localStorage');
    }
  }
  
  console.log('[DEBUG] Final headers:', config.headers);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log('[DEBUG] Response received:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('[DEBUG] Response error:', error.response?.status, error.response?.data);
    
    // If token is invalid or expired, redirect to login
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('[DEBUG] Auth error - clearing token and redirecting to login');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gj_token');
        window.location.href = '/';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;