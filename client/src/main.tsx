import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { syncDocument } from './i18n/core';
import './styles.css';

// <html lang> and the tab title follow the saved or browser language from the start.
syncDocument();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
