import { cn } from "@/lib/utils";

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-9 items-center rounded-md border bg-muted p-0.5">
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("h-full rounded-[5px] px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground", value === v && "bg-card font-medium text-foreground shadow-xs")}>
          {text}
        </button>
      ))}
    </div>
  );
}
