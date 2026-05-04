import { Component } from 'react';
import logger from '../utils/logger';

/**
 * React Error Boundary — catches unhandled render/lifecycle errors in the
 * component subtree and shows a fallback UI instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * Optional `fallback` prop renders custom UI:
 *   <ErrorBoundary fallback={<MyFallback />}>…</ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    logger.error('React component error:', error.message, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-500 px-4">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-heading font-bold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-400 text-sm mb-2 leading-relaxed">
            An unexpected error occurred in this section.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left bg-black/40 rounded-lg p-3 text-xs text-red-300 mb-4 overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={this.handleReset} className="btn-secondary py-2 px-5 text-sm">
              Try Again
            </button>
            <button onClick={() => window.location.reload()} className="btn-primary py-2 px-5 text-sm">
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
