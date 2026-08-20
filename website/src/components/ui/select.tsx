import * as React from "react"
import { cn } from "../../lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-[48px] w-full items-center justify-between rounded-lg border border-white/20 bg-[#0a0a0a] px-4 py-3 text-base text-ink transition-all placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer hover:border-white/30",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }
