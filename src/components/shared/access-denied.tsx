import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PageAccessDenied } from "@/lib/auth/page-access";

type AccessDeniedProps = {
  reason: PageAccessDenied;
};

const copy: Record<PageAccessDenied, { title: string; description: string }> = {
  inactive: {
    title: "Account inactive",
    description:
      "Your account has been deactivated. If you believe this is a mistake, contact an administrator.",
  },
  forbidden: {
    title: "Access denied",
    description: "You do not have permission to view this page with your current role.",
  },
};

export function AccessDenied({ reason }: AccessDeniedProps) {
  const { title, description } = copy[reason];
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Card className="border-destructive/20 bg-card/80 max-w-md shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {reason === "forbidden"
              ? "Use the sidebar to open a section you are allowed to access."
              : "Sign out and use an active account if you have one."}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
            Go to dashboard
          </Link>
          {reason === "inactive" ? (
            <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Back to sign in
            </Link>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
