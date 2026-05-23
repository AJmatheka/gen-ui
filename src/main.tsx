import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initLegacyApp } from './legacy';
import './styles.css';

function Root() {
  useEffect(() => {
    initLegacyApp();
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')!).render(<Root />);
