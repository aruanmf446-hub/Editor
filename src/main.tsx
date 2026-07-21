import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';
import './styles/assets.css';
import './styles/el-fuego.css';
import './styles/editor-config-panels.css';
import './styles/enemy-range-editor.css';
import './styles/runtime-enemies.css';
import './styles/runtime-pickups.css';
import './styles/runtime-advanced.css';
import './styles/sequence-performance.css';
import './styles/runtime-sequence.css';
import './styles/responsive.css';
import './styles/responsive-tablet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
