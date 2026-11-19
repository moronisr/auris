import PaginaInfo from "@/components/PaginaInfo";

export const metadata = { title: "Termos de uso do Auris" };

export default function Termos() {
  return (
    <PaginaInfo titulo="Termos de uso" atualizado="19 de novembro de 2026">
      <p>Ao criar uma conta no Auris, o profissional concorda com estes termos.</p>

      <h2>1. O que é o Auris</h2>
      <p>Uma ferramenta de apoio à documentação clínica: transcreve áudio, organiza a ficha para revisão, guarda o prontuário, gera documentos e oferece teleconsulta, agenda online e confirmação de pagamento. O Auris não presta serviço de saúde, não faz diagnóstico e não intermedeia a relação entre profissional e paciente.</p>

      <h2>2. Quem pode usar</h2>
      <p>Profissionais de saúde com registro ativo no respectivo conselho (CRM, CRO, CRP ou outro). O profissional declara que as informações do seu cadastro são verdadeiras.</p>

      <h2>3. Responsabilidades do profissional</h2>
      <ul>
        <li>Revisar e aprovar cada ficha antes de salvar; o conteúdo do prontuário e dos documentos é de sua responsabilidade.</li>
        <li>Informar o paciente sobre o uso do assistente de IA e respeitar se ele preferir que não seja usado.</li>
        <li>Seguir as normas do seu conselho para atendimento presencial e online, prontuário, prescrição e publicidade.</li>
        <li>Manter a senha em sigilo e usar o Auris em aparelho e local adequados ao sigilo profissional.</li>
        <li>Exportar e guardar o prontuário pelo prazo legal, especialmente se encerrar a conta.</li>
      </ul>

      <h2>4. Responsabilidades do Auris</h2>
      <ul>
        <li>Manter o serviço funcionando com cuidado e segurança, e avisar sobre mudanças relevantes.</li>
        <li>Tratar os dados conforme a <a href="/privacidade">Política de privacidade</a>.</li>
        <li>Permitir a exportação das fichas a qualquer momento.</li>
      </ul>

      <h2>5. Limitações da inteligência artificial</h2>
      <p>A transcrição e a organização automática podem conter erros. O Auris não garante que o texto gerado esteja completo ou correto; por isso a revisão do profissional é obrigatória. Saiba mais em <a href="/ia">Como a IA do Auris funciona</a>.</p>

      <h2>6. Pagamentos de teleconsulta</h2>
      <p>O pagamento do paciente vai direto para a conta do profissional na instituição que ele escolher (Mercado Pago ou PagBank). O Auris não recebe nem guarda esses valores. Tarifas, estornos e disputas seguem as regras da instituição de pagamento.</p>

      <h2>7. Planos</h2>
      <p>Durante o período de teste, o uso é gratuito. Os planos pagos, quando disponíveis, terão preço, recursos e condições informados antes da contratação.</p>

      <h2>8. Encerramento</h2>
      <p>O profissional pode encerrar a conta quando quiser, depois de exportar suas fichas. O Auris pode suspender contas em caso de uso indevido ou violação destes termos, com aviso prévio sempre que possível.</p>

      <h2>9. Lei aplicável</h2>
      <p>Estes termos seguem a legislação brasileira.</p>

      <h2>10. Contato</h2>
      <p><a href="mailto:aurismedical2@gmail.com">aurismedical2@gmail.com</a></p>
    </PaginaInfo>
  );
}
