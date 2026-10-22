import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChartNoAxesColumn, LayoutGrid, LogOut } from "lucide-react";
import { Link, NavLink, Navigate, Outlet } from "react-router";
import { ApiError, getMe, logout } from "@/api";
import { Logo } from "@/components/ornaments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { to: "/equipe", label: "Agenda", icon: CalendarDays, end: true },
  { to: "/equipe/mesas", label: "Mesas", icon: LayoutGrid, end: false },
  { to: "/equipe/painel", label: "Painel", icon: ChartNoAxesColumn, end: false },
];

export function StaffLayout() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false, staleTime: 60_000 });
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.clear(),
  });

  if (me.isPending) return <p className="text-muted-foreground p-8">Carregando…</p>;
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/equipe/login" replace />;
    return <p className="text-destructive p-8">Não foi possível carregar a área da equipe.</p>;
  }
  if (signOut.isSuccess) return <Navigate to="/equipe/login" replace />;

  return (
    <div className="min-h-screen">
      <header className="border-border/70 bg-card/60 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link to="/equipe" className="flex items-center gap-2" aria-label="Pincelada, área da equipe">
            <Logo className="size-9" />
            <span className="font-display text-lg font-semibold">Equipe</span>
          </Link>

          <nav aria-label="Área da equipe" className="flex flex-1 gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{me.data.name}</span>
            <Button variant="outline" size="sm" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
              <LogOut /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
