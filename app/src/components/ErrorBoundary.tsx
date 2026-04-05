import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error("App render failed", error);
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            maxWidth: 960,
            margin: "40px auto",
            padding: 24,
            borderRadius: 16,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(104, 137, 169, 0.22)",
            boxShadow: "0 20px 60px rgba(17, 32, 49, 0.08)",
            fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif",
            color: "#112031",
          }}
        >
          <h1 style={{ marginTop: 0 }}>App failed to render</h1>
          <p>
            The page hit a runtime error before it could mount. The details below should help us fix it.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 16,
              borderRadius: 12,
              background: "#eff6fb",
              overflowX: "auto",
            }}
          >
            {this.state.error.stack || this.state.error.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
