import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

function Root() {
  const [locale, setLocale] = React.useState('en');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    window.api.getLocale().then(loc => {
      // Map system locale to our supported locales
      // e.g. "es-419" → "es", "zh-CN" → "zh", "pt-BR" → "pt-BR"
      setLocale(loc || 'en');
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <React.StrictMode>
      <App detectedLocale={locale} />
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
