import { cn } from "@/lib/utils";

/** Filtros SVG compartilhados: a borda irregular de pincel usada pela classe `.paint`. */
export function PaintFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        <filter id="rough-edge" x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="wet-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>
    </svg>
  );
}

type DecoProps = { className?: string };

/** Respingo de tinta. Decorativo: fica fora da árvore de acessibilidade. */
export function Splatter({ className }: DecoProps) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={cn("pointer-events-none absolute", className)}>
      <g fill="currentColor" filter="url(#wet-edge)">
        <path d="M100 28c22-6 38 8 46 26 14 4 30 14 28 34-2 16-16 22-24 30 6 16-2 36-22 42-14 4-24-2-34-10-16 8-38 4-46-14-6-14 2-26 8-34-12-14-10-36 8-46 8-4 16-4 22-6 4-12 6-20 14-22z" />
        <circle cx="30" cy="40" r="9" />
        <circle cx="176" cy="150" r="7" />
        <circle cx="160" cy="24" r="4" />
        <circle cx="22" cy="150" r="5" />
        <circle cx="188" cy="94" r="3.5" />
      </g>
    </svg>
  );
}

/** Pincelada larga, como uma mancha de aquarela atrás de um título ou de uma seção. */
export function Wash({ className }: DecoProps) {
  return (
    <svg
      viewBox="0 0 600 160"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("pointer-events-none absolute", className)}
    >
      <path
        filter="url(#wet-edge)"
        fill="currentColor"
        d="M14 84C40 30 120 18 220 30S420 12 520 28s74 40 60 78-84 48-176 40S190 160 100 140 -6 128 14 84z"
      />
    </svg>
  );
}

/** Marca da casa: círculo pintado com um garfo e uma colher cruzados. */
export function Logo({ className }: DecoProps) {
  return (
    <span className={cn("paint paint-card relative grid size-11 place-items-center rounded-full text-primary-foreground", className)} style={{ ["--paint" as string]: "var(--primary)" }}>
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7M6 3v4M18 3c-2 1-3 4-3 7 0 1.5 1 2.5 2 2.5V21" />
      </svg>
    </span>
  );
}
