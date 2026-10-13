import { useMatrix } from "@/lib/store";
import { countries } from "@/lib/countries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const NONE = "__none";

/** Country picker; stores the ISO 3166-1 alpha-2 code. */
export function CountrySelect({ id, value, onChange, disabled }: { id?: string; value: string | null | undefined; onChange: (code: string | null) => void; disabled?: boolean }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose a country" /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>No fixed country</SelectItem>
        {countries().map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Organisation picker, from `orgs` in sites.yaml. */
export function OrgSelect({ id, value, onChange, disabled }: { id?: string; value: string | undefined; onChange: (org: string) => void; disabled?: boolean }) {
  const { orgs } = useMatrix();
  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose an organisation" /></SelectTrigger>
      <SelectContent>{Object.entries(orgs).map(([k, o]) => <SelectItem key={k} value={k}>{o.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
