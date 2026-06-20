import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-2xl",
          "border border-foreground/10 bg-background/60",
          "backdrop-blur-sm",
          "px-4 py-2",
          "text-sm text-foreground",
          "placeholder:text-muted-foreground/50",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
          "hover:border-foreground/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
