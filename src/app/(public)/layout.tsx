export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6">
      {children}
    </div>
  );
}
