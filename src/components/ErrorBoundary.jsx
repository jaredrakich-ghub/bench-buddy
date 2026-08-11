import React from "react";

// Catches JS errors anywhere below it in the tree and shows a fallback
// message instead of an unhandled error leaving the coach with a blank
// screen mid-match. React error boundaries have to be class components —
// there's no hook equivalent for this.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Bench Buddy crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            maxWidth: 480,
            margin: "48px auto",
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#555", marginBottom: 20 }}>
            Bench Buddy hit an unexpected error. Your saved squad and settings
            are safe — reloading the page should get you back to normal.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
