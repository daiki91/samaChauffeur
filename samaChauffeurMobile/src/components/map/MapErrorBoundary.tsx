import React from 'react';

type Props = { children: React.ReactNode; fallback: React.ReactNode };
type State = { hasError: boolean };

/**
 * react-native-maps needs a native module that may not always be available
 * (e.g. certain Expo Go builds). Rather than crash the whole screen, we catch
 * render errors here and fall back to a styled placeholder.
 */
export default class MapErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // no-op: swallow the error, UI already falls back below
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
