import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { login } from "@/api";
import { frameClass } from "@/components/layout";
import { Logo, Wordmark } from "@/components/ornaments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/errors";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signIn = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
      void navigate("/equipe", { replace: true });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    signIn.mutate({ email: String(form.get("email")), password: String(form.get("password")) });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="mb-8 flex items-center gap-3 self-center" aria-label="Pincelada, página inicial">
        <Logo />
        <Wordmark />
      </Link>
      <Card className={frameClass}>
        <form onSubmit={onSubmit}>
          <CardHeader className="mb-4">
            <CardTitle className="text-3xl font-medium">Área da equipe</CardTitle>
            <CardDescription>Entre com o e-mail e a senha da equipe.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="username" required className="bg-background/60 h-11" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required className="bg-background/60 h-11" />
            </div>
            {signIn.isError && (
              <p role="alert" className="text-destructive font-medium">
                {errorMessage(signIn.error)}
              </p>
            )}
            <Button type="submit" size="lg" disabled={signIn.isPending} className="mt-2 h-12 w-full text-base">
              {signIn.isPending ? "Entrando…" : "Entrar"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </main>
  );
}
