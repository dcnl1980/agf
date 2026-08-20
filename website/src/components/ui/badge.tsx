import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 font-heading text-xs font-bold uppercase tracking-[0.06em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-surface-card border border-border text-ink-secondary",
        live:
          "bg-success-bg border border-success-border text-[#6EDB6E] [[data-theme='light']_&]:text-[#2d6b2d]",
        roadmap:
          "bg-roadmap-bg border border-roadmap-border text-[#CBA4FF] [[data-theme='light']_&]:text-[#6b3f99]",
        prototype:
          "bg-caution-bg border border-caution-border text-caution-text [[data-theme='light']_&]:text-[#a97b00]",
        outline:
          "bg-transparent border border-border text-ink hover:bg-surface-card",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
