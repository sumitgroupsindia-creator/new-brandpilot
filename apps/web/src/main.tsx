import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { FeedbackProvider } from '@brandpilot/shared';
import App from './App';
import './index.css';
import { webQueryClient } from './lib/query';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <QueryClientProvider client={webQueryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </FeedbackProvider>
  </React.StrictMode>,
);
