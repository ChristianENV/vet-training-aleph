import { BrandMark } from "@/components/shared/brand-mark";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark variant="auth" />
        <p className="text-muted-foreground mt-3 text-sm">Training workspace</p>
      </div>
      {children}
    </div>
  );
}
