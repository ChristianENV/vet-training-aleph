import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils/index"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "border border-destructive/20 bg-error-100 text-destructive focus-visible:ring-destructive/25 dark:border-destructive/40 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-error-100/80",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "border border-success-500/20 bg-success-100 text-success-500 [a]:hover:bg-success-100/80",
        warning:
          "border border-warning-500/30 bg-warning-100 text-foreground [a]:hover:bg-warning-100/90",
        info:
          "border border-info-500/25 bg-info-100 text-info-500 [a]:hover:bg-info-100/85",
        progress:
          "border border-brand-cyan-600/30 bg-brand-cyan-500/10 text-brand-navy-800 dark:border-brand-cyan-500/35 dark:bg-brand-cyan-700/25 dark:text-foreground [a]:hover:bg-brand-cyan-500/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
