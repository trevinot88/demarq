import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { RoleProvider } from './context/RoleContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <RoleProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1a2e',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            },
            success: { iconTheme: { primary: '#4ade80', secondary: '#1a1a2e' } },
            error:   { iconTheme: { primary: '#e94560', secondary: '#1a1a2e' } },
          }}
        />
      </RoleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
