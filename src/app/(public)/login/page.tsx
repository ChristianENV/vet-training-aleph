import { LoginForm } from "@/components/shared/login-form";

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ callbackUrl?: string }>;
}>) {
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />;
}
