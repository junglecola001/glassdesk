import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/index.css';
import { primeWorkspaceFromMirror } from '../features/desktops/bootstrap';
import { App } from './App';

primeWorkspaceFromMirror();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
