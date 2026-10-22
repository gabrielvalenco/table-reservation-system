import { Link } from "react-router";

// Texto-base para revisão jurídica: o nome e o contato do controlador dependem do restaurante.
const sections: { title: string; body: string[] }[] = [
  {
    title: "Quais dados coletamos",
    body: ["Nome, telefone e e-mail, mais as observações que você escrever (por exemplo, restrições alimentares). Não pedimos nenhum outro dado."],
  },
  {
    title: "Para que usamos",
    body: [
      "Só para fazer e gerenciar a sua reserva: reservar a mesa, avisar você por e-mail, permitir o cancelamento e contatar você se algo mudar. Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing.",
    ],
  },
  {
    title: "Por quanto tempo guardamos",
    body: [
      "Depois de 180 dias da data da reserva, apagamos nome, telefone, e-mail e observações. Mantemos só o registro sem identificação (data, horário e número de pessoas) para estatísticas.",
    ],
  },
  {
    title: "Seus direitos",
    body: [
      "Pela LGPD (Lei 13.709/2018), você pode pedir acesso, correção ou eliminação dos seus dados, e informações sobre o uso deles. Para exercer qualquer direito, fale com o restaurante pelo contato abaixo.",
    ],
  },
  {
    title: "Como protegemos",
    body: [
      "A conexão é criptografada (HTTPS). O link da sua reserva é secreto e guardado de forma protegida: só quem tem o link pode vê-lo ou cancelar. Guarde-o e não o compartilhe.",
    ],
  },
  {
    title: "Contato do responsável",
    body: ["[A definir pelo restaurante: nome do responsável pelos dados e e-mail de contato.]"],
  },
];

export function PrivacyPage() {
  return (
    <main className="relative mx-auto max-w-2xl px-5 pt-12 pb-24 lg:pt-20">
      <h1 className="text-4xl font-medium md:text-5xl">Aviso de privacidade</h1>
      <p className="text-muted-foreground mt-4">
        Explicamos de forma direta o que fazemos com os seus dados quando você faz uma reserva.
      </p>

      <div className="mt-10 grid gap-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-2xl font-medium">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground mt-2 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="mt-12">
        <Link to="/" className="text-primary underline underline-offset-4">
          Voltar para a reserva
        </Link>
      </p>
    </main>
  );
}
