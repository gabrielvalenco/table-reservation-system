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

/** Marca da casa: um prato desenhado a pincel, com um garfo e um pincel cruzados no centro. */
export function Logo({ className }: DecoProps) {
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className={cn("size-14 shrink-0", className)}>
      <g filter="url(#rough-edge)">
        <circle cx="28" cy="28" r="23" fill="var(--card)" />
        <path
          d="M28 5.5c12.6 0 22.5 10 22.5 22.5S40.6 50.5 28 50.5 5.5 40.6 5.5 28c0-6 2.2-11 6-14.8"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="var(--foreground)" strokeWidth="2.2">
          <path d="M19 15v7a3.5 3.5 0 0 0 7 0v-7M22.5 15v26" />
        </g>
        <g transform="rotate(24 35 28)">
          <path d="M35 14v13" stroke="var(--foreground)" strokeWidth="3.2" />
          <path d="M35 27v4" stroke="var(--muted-foreground)" strokeWidth="4.5" />
          <path d="M35 31c-3.2 2.8-3.2 7.5 0 9.5 3.2-2 3.2-6.7 0-9.5z" fill="var(--ochre)" stroke="none" />
        </g>
      </g>
    </svg>
  );
}

/** Nome da casa em letra de pincel, com um traço de tinta embaixo. */
export function Wordmark({ className }: DecoProps) {
  return (
    <div className={cn("leading-none", className)}>
      <p className="font-cartoon sticker-text text-primary [--sticker-stroke:0.07em] relative text-4xl -rotate-2">
        Pincelada
        <svg viewBox="0 0 160 10" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-1 left-1 h-2 w-[92%]">
          <path d="M2 6C30 1 70 9 110 4s40 1 48 0" fill="none" stroke="var(--ochre)" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </p>
      <p className="text-muted-foreground mt-2 pl-1 text-[0.65rem] font-medium tracking-[0.32em] uppercase">
        Cozinha de autor
      </p>
    </div>
  );
}
