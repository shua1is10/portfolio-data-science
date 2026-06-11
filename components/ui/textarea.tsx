import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[130px] w-full rounded-2xl",
          "border border-foreground/10 bg-background/60",
          "backdrop-blur-sm",
          "px-4 py-3",
          "text-sm text-foreground leading-relaxed",
          "placeholder:text-muted-foreground/50",
          "resize-none",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
          "hover:border-foreground/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
