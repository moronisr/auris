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
        <li>Cumprir a política de cancelamento que publicou, devolver os valores devidos ao paciente e emitir nota fiscal ou recibo dos atendimentos.</li>
      </ul>

      <h2>4. Responsabilidades do Auris</h2>
      <ul>
        <li>Manter o serviço funcionando com cuidado e segurança, e avisar sobre mudanças relevantes.</li>
        <li>Tratar os dados conforme a <a href="/privacidade">Política de privacidade</a>.</li>
        <li>Permitir a exportação das fichas a qualquer momento.</li>
      </ul>

      <h2>5. Limitações da inteligência artificial</h2>
      <p>A transcrição e a organização automática podem conter erros. O Auris não garante que o texto gerado esteja completo ou correto; por isso a revisão do profissional é obrigatória. Saiba mais em <a href="/ia">Como a IA do Auris funciona</a>.</p>

      <h2>6. Pagamentos, cancelamento e devolução</h2>
      <h3>6.1 Como o pagamento funciona</h3>
      <ul>
        <li>O pagamento da teleconsulta vai <b>direto para a conta do profissional</b> na instituição de pagamento que ele conectou ao Auris (hoje, o Mercado Pago). O Auris <b>não recebe, não guarda e não repassa valores</b>, e não é parte da relação de consumo entre profissional e paciente.</li>
        <li>No <b>Pix</b>, o código e o QR Code são gerados pela instituição de pagamento, na conta do profissional, e mostrados na página do Auris. O paciente paga pelo aplicativo de qualquer banco, sem precisar de conta na instituição.</li>
        <li>No <b>cartão de crédito ou débito</b>, os dados do cartão são digitados em um formulário seguro da própria instituição de pagamento. O Auris não vê nem guarda o número do cartão, a validade ou o código de segurança.</li>
        <li>O valor cobrado é sempre o valor da consulta definido pelo profissional no Auris. A confirmação do pagamento é feita somente por consulta direta à instituição de pagamento; avisos enviados pelo navegador não confirmam pagamento.</li>
        <li>Tarifas da instituição de pagamento são do profissional e seguem o contrato dele com a instituição.</li>
        <li>Quando o profissional usa apenas a própria chave Pix ou um link de pagamento de outra empresa, o Auris não tem acesso ao pagamento: o profissional confere o recebimento e confirma no Auris, e responde por essa confirmação.</li>
      </ul>

      <h3>6.2 Reserva do horário</h3>
      <p>Ao escolher um horário na página do profissional, ele fica reservado por 30 minutos para o pagamento. No Pix, a reserva vale até o vencimento do código gerado. Se o pagamento não for feito no prazo, o horário volta a ficar livre.</p>

      <h3>6.3 Política de cancelamento</h3>
      <ul>
        <li>Cada profissional define no Auris até quando o paciente pode cancelar com devolução integral (de 2 a 72 horas antes do horário). Essa política é mostrada ao paciente <b>antes do pagamento</b>, na página de agendamento, e fica disponível no link da consulta, em &quot;Ajuda e política de cancelamento&quot;.</li>
        <li>Dentro do prazo, o paciente pode cancelar pelo próprio link da consulta e recebe o valor integral de volta, automaticamente, na mesma forma de pagamento.</li>
        <li>Depois do prazo, ou se o paciente não entrar na consulta, o valor não é devolvido, salvo acordo entre o profissional e o paciente.</li>
        <li><b>Se o profissional cancelar a consulta, deve devolver o valor integral ao paciente</b>, salvo se já tiver combinado com ele outra solução, como a remarcação.</li>
      </ul>

      <h3>6.4 Devolução</h3>
      <ul>
        <li>O profissional devolve pelo próprio Auris, em &quot;Cancelar e devolver&quot;. A devolução é processada pela instituição de pagamento.</li>
        <li><b>Prazos:</b> no Pix, o valor volta para a conta que pagou, em geral em poucos minutos. No cartão, o estorno aparece na fatura conforme o banco emissor, em geral em até duas faturas.</li>
        <li>A devolução usa o saldo da conta do profissional na instituição de pagamento. Se não houver saldo suficiente, a instituição pode recusar a devolução até que haja saldo; o profissional é responsável por concluí-la.</li>
        <li>Se o mesmo paciente pagar a mesma consulta mais de uma vez, o Auris avisa o profissional, que deve devolver o valor em duplicidade.</li>
      </ul>

      <h3>6.5 Contestações e nota fiscal</h3>
      <ul>
        <li>Contestações de compra feitas pelo paciente no banco ou na operadora do cartão (chargeback) são tratadas pela instituição de pagamento, conforme as regras dela, e respondidas pelo profissional.</li>
        <li>O comprovante mostrado ao paciente no Auris comprova o pagamento, mas não é nota fiscal nem recibo de serviço de saúde. A emissão de nota fiscal ou recibo é responsabilidade do profissional.</li>
      </ul>

      <h2>7. Planos</h2>
      <p>Durante o período de teste, o uso é gratuito. Os planos pagos, quando disponíveis, terão preço, recursos e condições informados antes da contratação.</p>

      <h2>8. Encerramento</h2>
      <p>O profissional pode encerrar a conta quando quiser, depois de exportar suas fichas. O Auris pode suspender contas em caso de uso indevido ou violação destes termos, com aviso prévio sempre que possível.</p>

      <h2>9. Lei aplicável</h2>
      <p>Estes termos seguem a legislação brasileira.</p>

      <h2>10. Contato</h2>
      <p><a href="mailto:contato@aurismed.com.br">contato@aurismed.com.br</a></p>
    </PaginaInfo>
  );
}
