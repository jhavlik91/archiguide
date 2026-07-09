export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div data-area="public">{children}</div>;
}
