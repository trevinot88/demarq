import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import App from './App.jsx';
import { RoleProvider } from './context/RoleContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// Include session cookie in every request automatically
axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#2B1A12',
                color: '#FFF4E4',
                border: '1px solid rgba(177,170,129,0.3)',
                borderRadius: '12px',
              },
              success: { iconTheme: { primary: '#4ade80', secondary: '#2B1A12' } },
              error:   { iconTheme: { primary: '#dc2626', secondary: '#2B1A12' } },
            }}
          />
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
