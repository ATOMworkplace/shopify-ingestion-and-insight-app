import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'ngrok-skip-browser-warning': 'true', 
  }
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gj_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gj_token');
        window.location.href = '/';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;