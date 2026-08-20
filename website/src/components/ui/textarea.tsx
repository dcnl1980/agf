import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[150px] w-full rounded-lg border border-white/20 bg-[#0a0a0a] px-4 py-3 text-base text-ink transition-all placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
