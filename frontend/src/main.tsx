import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/Toast';
import { FilterProvider } from './lib/filters';
import App from './App';
import './index.css';
const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}><BrowserRouter><AuthProvider><FilterProvider><ToastProvider>
      <App />
    </ToastProvider></FilterProvider></AuthProvider></BrowserRouter></QueryClientProvider>
  </React.StrictMode>);
