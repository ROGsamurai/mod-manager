import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

function Root() {
  const [locale, setLocale] = React.useState('en');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // A language the user explicitly picked always wins and must survive restarts.
    // Only fall back to the OS locale when nothing has been saved yet (first run).
    Promise.resolve(window.api.getLanguage ? window.api.getLanguage() : null)
      .then(saved => {
        if (saved) { setLocale(saved); setReady(true); return; }
        return window.api.getLocale().then(loc => { setLocale(loc || 'en'); setReady(true); });
      })
      .catch(() => {
        // Settings unavailable — fall back to system locale, then English.
        Promise.resolve(window.api.getLocale ? window.api.getLocale() : 'en')
          .then(loc => setLocale(loc || 'en'))
          .catch(() => {})
          .finally(() => setReady(true));
      });
  }, []);

  if (!ready) return null;

  return (
    <React.StrictMode>
      <App detectedLocale={locale} />
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
