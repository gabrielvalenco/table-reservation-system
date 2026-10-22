import { cn } from "@/lib/utils";

type DecoProps = { className?: string };

/** Marca da casa: um selo com anel duplo, um P em itálico e um pequeno losango terracota. */
export function Logo({ className }: DecoProps) {
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className={cn("size-12 shrink-0", className)}>
      <circle cx="28" cy="28" r="25" fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
      <circle cx="28" cy="28" r="21.5" fill="none" stroke="var(--foreground)" strokeWidth="0.6" />
      <text
        x="27"
        y="37"
        textAnchor="middle"
        fontSize="30"
        fontStyle="italic"
        fontWeight="600"
        fill="var(--foreground)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        P
      </text>
      <path fill="var(--terracotta)" d="M40.5 36.5l3 3-3 3-3-3z" />
    </svg>
  );
}

/** Nome da casa em serifa de alto contraste, com a descrição em caixa-alta espaçada. */
export function Wordmark({ className }: DecoProps) {
  return (
    <div className={cn("leading-none", className)}>
      <p className="font-display text-foreground text-2xl font-semibold tracking-wide">Pincelada</p>
      <p className="text-muted-foreground mt-1.5 text-[0.62rem] font-medium tracking-[0.38em] uppercase">
        Cozinha de autor
      </p>
    </div>
  );
}

/** Divisor de menu: duas linhas finas com um losango no meio. */
export function Ornament({ className }: DecoProps) {
  return (
    <div aria-hidden="true" className={cn("text-gold flex items-center gap-3", className)}>
      <span className="h-px flex-1 bg-current opacity-60" />
      <svg viewBox="0 0 12 12" className="size-2.5 fill-current">
        <path d="M6 0l6 6-6 6-6-6z" />
      </svg>
      <span className="h-px flex-1 bg-current opacity-60" />
    </div>
  );
}

/** Ilustração em linha de uma mesa posta: prato, garfo, faca e um raminho de folhas. */
export function PlaceSetting({ className }: DecoProps) {
  return (
    <svg
      viewBox="0 0 160 160"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-gold", className)}
    >
      <circle cx="80" cy="90" r="46" />
      <circle cx="80" cy="90" r="35" />
      <circle cx="80" cy="90" r="22" strokeDasharray="1 5" />
      <path d="M16 44v24M22 44v24M28 44v24M16 68c0 9 12 9 12 0M22 77v62" />
      <path d="M138 44c10 12 10 44 0 58M138 44v95" />
      <path d="M80 8v22M80 18c-9-2-13-9-13-9s9-2 13 5M80 18c9-2 13-9 13-9s-9-2-13 5" />
    </svg>
  );
}
