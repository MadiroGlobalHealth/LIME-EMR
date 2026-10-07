import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        outline: "border bg-card shadow-xs hover:bg-muted",
        ghost: "hover:bg-muted",
        accent: "bg-new text-white shadow-xs hover:bg-new/90 dark:text-background",
        link: "h-auto px-0 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
      },
      size: { default: "h-9 px-3.5", sm: "h-8 px-3 text-[13px]", xs: "h-7 px-2 text-xs", icon: "size-9", "icon-sm": "size-8" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, asChild, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
