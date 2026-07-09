export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div data-area="admin">{children}</div>;
}
