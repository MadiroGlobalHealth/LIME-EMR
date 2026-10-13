import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** One-line tooltip around a single trigger element. */
export function Tip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent sideOffset={6} className="max-w-72">{content}</TooltipContent>
    </Tooltip>
  );
}
