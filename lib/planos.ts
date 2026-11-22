/** Planos do Auris. Consultas ilimitadas em todos; o plano mais alto libera todos os recursos. */
export type Plano = { id: string; nome: string; valor: number; resumo: string; recursos: string[]; destaque?: boolean; oculto?: boolean };

export const PLANOS: Plano[] = [
  {
    id: "essencial", nome: "Essencial", valor: 179,
    resumo: "Registro por voz e prontuário para o consultório presencial.",
    recursos: ["Consultas ilimitadas", "Ficha preenchida por voz, com revisão", "Prontuário, PDF do dia e exportação", "Receita com assinatura gov.br"],
  },
  {
    id: "profissional", nome: "Pro", valor: 249, destaque: true,
    resumo: "Tudo do Essencial, mais teleconsulta e agenda online.",
    recursos: ["Tudo do Essencial", "Teleconsulta com sala própria", "Agenda online com página de agendamento", "Pagamento do paciente com confirmação automática"],
  },
  {
    id: "completo", nome: "Max", valor: 329,
    resumo: "Todos os recursos do Auris.",
    recursos: ["Tudo do Pro", "Assinatura digital da ficha (ICP-Brasil)", "Lembretes automáticos por WhatsApp", "Atendimento prioritário"],
  },
  // Plano de teste (R$ 5), visível só para administradores do Auris, para testar a cobrança real.
  // R$ 5 em vez de R$ 1: cobranças de R$ 1 repetidas no mesmo cartão costumam ser barradas pelo antifraude.
  { id: "teste", nome: "Teste interno", valor: 5, resumo: "Somente para teste da cobrança.", recursos: ["Cobrança real de R$ 5 por mês"], oculto: true },
];

export const planoPorId = (id?: string | null) => PLANOS.find((p) => p.id === id) || null;
export const DIAS_TESTE = 10;
export const DIAS_TOLERANCIA = 7;
