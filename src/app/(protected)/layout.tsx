import { AppShell } from "@/components/shared/app-shell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user;
  return (
    <AppShell
      user={{
        email: u.email ?? "",
        role: u.role,
        name: u.name,
      }}
    >
      {children}
    </AppShell>
  );
}
