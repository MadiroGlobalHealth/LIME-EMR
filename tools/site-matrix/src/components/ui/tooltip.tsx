import * as React from "react";
import { Tooltip as T } from "radix-ui";

export const TooltipProvider = T.Provider;
export function Tip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  if (!content) return children;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="z-50 max-w-72 rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground shadow-md">{content}</T.Content>
      </T.Portal>
    </T.Root>
  );
}
