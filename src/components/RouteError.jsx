import React from 'react';
export default class RouteError extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card panel stack" role="alert">
        <h1>This workspace could not load</h1>
        <p>Reload the page or return to the dashboard.</p>
        <div className="field-row">
          <button className="button" onClick={() => window.location.reload()}>
            Reload workspace
          </button>
          <a className="button secondary" href="/">
            Dashboard
          </a>
        </div>
      </section>
    );
  }
}
