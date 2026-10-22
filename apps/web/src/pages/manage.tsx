import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, cancelManaged, getManaged } from "@/api";
import { frameClass } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/errors";
import { formatDate, formatTime, people } from "@/format";

const statusLabel = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Concluída",
  no_show: "Não compareceu",
} as const;

export function ManagePage() {
  const { token = "" } = useParams();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const reservation = useQuery({
    queryKey: ["managed", token],
    queryFn: () => getManaged(token),
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: () => cancelManaged(token),
    onSuccess: () => {
      setConfirming(false);
      return queryClient.invalidateQueries({ queryKey: ["managed", token] });
    },
    onError: () => setConfirming(false),
  });

  const data = reservation.data;

  return (
    <main className="relative mx-auto max-w-xl px-5 pt-12 pb-24 lg:pt-20">
      {reservation.isPending && <p className="text-muted-foreground">Carregando a reserva…</p>}

      {reservation.isError && (
        <Card className={frameClass}>
          <CardHeader>
            <CircleX className="text-terracotta mb-2 size-10" strokeWidth={1.5} aria-hidden="true" />
            <CardTitle className="text-3xl font-medium">Reserva não encontrada</CardTitle>
            <CardDescription>
              {reservation.error instanceof ApiError && reservation.error.status === 404
                ? "O link pode estar incompleto ou a reserva já foi removida por prazo de retenção."
                : errorMessage(reservation.error)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg">
              <Link to="/">Fazer uma nova reserva</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card className={frameClass}>
          <CardHeader>
            {data.status === "confirmed" ? (
              <CircleCheck className="text-forest mb-2 size-10" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <CircleX className="text-muted-foreground mb-2 size-10" strokeWidth={1.5} aria-hidden="true" />
            )}
            <CardTitle className="text-3xl font-medium">Sua reserva</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant={data.status === "confirmed" ? "default" : "secondary"} className="font-sans font-medium">
                {statusLabel[data.status]}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <dl className="grid gap-3 text-base">
              <div>
                <dt className="text-muted-foreground text-sm">Nome</dt>
                <dd>{data.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Quando</dt>
                <dd className="first-letter:uppercase">
                  {formatDate(data.startsAt)}, às {formatTime(data.startsAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Mesa para</dt>
                <dd>{people(data.partySize)}</dd>
              </div>
            </dl>

            {cancel.isError && (
              <p role="alert" className="text-destructive font-medium">
                {errorMessage(cancel.error)}
              </p>
            )}

            {data.status === "confirmed" && data.canCancel && (
              <>
                <p className="text-muted-foreground text-sm">
                  Você pode cancelar até {formatDate(data.cancelDeadline)}, às {formatTime(data.cancelDeadline)}.
                </p>
                <Button variant="destructive" size="lg" onClick={() => setConfirming(true)}>
                  Cancelar reserva
                </Button>
              </>
            )}
            {data.status === "confirmed" && !data.canCancel && (
              <p className="text-muted-foreground text-sm">
                O prazo para cancelar por aqui já passou. Se precisar, fale diretamente com o restaurante.
              </p>
            )}
            {data.status === "cancelled" && (
              <Button asChild variant="outline" size="lg">
                <Link to="/">Fazer uma nova reserva</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar a reserva?</DialogTitle>
            <DialogDescription>Essa ação libera a mesa e não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Manter reserva</Button>
            </DialogClose>
            <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? "Cancelando…" : "Sim, cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
