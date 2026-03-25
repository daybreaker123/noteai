/**
 * Wraps each segment to provide a subtle entrance when navigating between pages.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="studara-page-transition min-h-dvh">{children}</div>;
}
