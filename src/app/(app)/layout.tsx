export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div data-area="app">{children}</div>;
}
