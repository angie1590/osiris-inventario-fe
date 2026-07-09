import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-token-sm hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-token-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-token-sm hover:-translate-y-0.5 hover:bg-destructive/92 hover:shadow-token-md",
        outline:
          "border border-input bg-background text-foreground shadow-token-sm hover:bg-accent/85 hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-token-sm hover:bg-secondary/75",
        ghost: "text-primary hover:bg-accent/65 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    if (asChild) {
      const resolvedChild = React.Children.toArray(children).find((child) =>
        React.isValidElement(child),
      ) as React.ReactElement<{ className?: string }> | undefined;
      if (!resolvedChild) return null;

      return React.cloneElement(resolvedChild, {
        ...props,
        className: cn(
          buttonVariants({ variant, size, className }),
          (disabled || isLoading) && "pointer-events-none opacity-50",
          resolvedChild.props.className,
        ),
      });
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
