import { LoginForm } from "@/components/shared/login-form";
import { sanitizeLoginCallbackUrl } from "@/lib/auth/safe-redirect";

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ callbackUrl?: string }>;
}>) {
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={sanitizeLoginCallbackUrl(callbackUrl)} />;
}
