import { Link, Outlet } from "react-router";
import { Logo, Wordmark } from "./ornaments";

export function PublicLayout() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <header className="border-border/70 relative border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-3" aria-label="Pincelada, página inicial">
            <Logo />
            <Wordmark />
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="text-muted-foreground border-border/70 relative border-t px-5 py-8 text-center text-sm">
        <p>Pincelada · Cozinha de autor · Horários em Brasília</p>
        <p className="mt-2 space-x-4">
          <Link to="/privacidade" className="hover:text-foreground underline underline-offset-4">
            Aviso de privacidade
          </Link>
          <Link to="/equipe" className="hover:text-foreground underline underline-offset-4">
            Área da equipe
          </Link>
        </p>
      </footer>
    </div>
  );
}

/** Cartão no estilo "menu": borda e uma segunda linha dourada por dentro. */
export const frameClass =
  "bg-card/90 border-border relative rounded-xl shadow-sm outline-gold/45 outline outline-1 -outline-offset-[7px] py-8";
