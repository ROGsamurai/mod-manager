import { Component } from 'react';

/**
 * Catches a render-time exception anywhere below it.
 *
 * Without this, one bad value in one component unmounts the whole React tree
 * and leaves the window black with no way out — no error, no menu, nothing to
 * click. That is what a user sees when a screen crashes, and it gives them
 * nothing to report either.
 *
 * With it, the error and the component stack stay on screen and the app can be
 * put back to a working screen without restarting.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Also to the console, so it is in the log if the user sends one.
    console.error('[renderer] crashed:', error, info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const details = [
      String(this.state.error?.stack || this.state.error),
      this.state.info?.componentStack || '',
    ].join('\n');

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg-base, #121519)', color: 'var(--text, #e9ecf1)',
        padding: 32, overflow: 'auto', fontSize: 14, zIndex: 9999,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong on this screen</h1>
        <p style={{ color: 'var(--text-3, #7f8b9c)', marginBottom: 16, lineHeight: 1.6 }}>
          Your mods and settings are untouched — this is a display error, not a change to your game.
          Going back should restore the app; if it happens again, the details below say why.
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <button className="btn btn-accent btn-sm" onClick={() => this.setState({ error: null, info: null })}>
            Go back
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>
            Reload the manager
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { try { navigator.clipboard.writeText(details); } catch {} }}>
            Copy details
          </button>
        </div>
        <pre className="mono" style={{
          whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5, color: 'var(--text-3, #7f8b9c)',
          background: 'var(--bg-deep, #0e1014)', border: '1px solid var(--border, #1d242c)',
          borderRadius: 8, padding: 14, margin: 0,
        }}>{details}</pre>
      </div>
    );
  }
}
