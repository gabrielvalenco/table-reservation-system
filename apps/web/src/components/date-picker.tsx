import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" <-> Date no calendário local, sem passar por UTC. */
const parse = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};
const format = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const label = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  /** Dias extras que não podem ser escolhidos (por exemplo, dias de folga). */
  disabled?: Matcher | Matcher[];
  className?: string;
};

export function DatePicker({ id, value, onChange, min, max, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);

  const unavailable: Matcher[] = [
    ...(min ? [{ before: parse(min) }] : []),
    ...(max ? [{ after: parse(max) }] : []),
    ...(disabled === undefined ? [] : Array.isArray(disabled) ? disabled : [disabled]),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("bg-background/70 h-11 w-full justify-between px-3 text-left text-base font-normal", className)}
        >
          <span className="flex items-center gap-2 first-letter:uppercase">
            <CalendarDays className="text-primary size-4" />
            {label.format(selected)}
          </span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="bg-card w-auto p-2 shadow-md"
      >
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          defaultMonth={selected}
          disabled={unavailable}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date));
            setOpen(false);
          }}
          classNames={{
            today: "[&>button]:ring-2 [&>button]:ring-terracotta [&>button]:font-bold",
          }}
          className="[--cell-size:--spacing(10)] sm:[--cell-size:--spacing(11)]"
        />
      </PopoverContent>
    </Popover>
  );
}
