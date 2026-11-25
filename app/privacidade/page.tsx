import PaginaInfo from "@/components/PaginaInfo";

export const metadata = { title: "Política de privacidade do Auris" };

export default function Privacidade() {
  return (
    <PaginaInfo titulo="Política de privacidade" atualizado="23 de novembro de 2026">
      <p>Esta política explica como o Auris trata dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).</p>

      <h2>1. Quem é quem</h2>
      <ul>
        <li><b>Profissional de saúde (controlador):</b> quem usa o Auris para registrar seus atendimentos decide quais dados dos pacientes são registrados e para quê. Pedidos de pacientes sobre seus dados de saúde devem ser feitos diretamente ao profissional que os atendeu.</li>
        <li><b>Auris (operador):</b> trata os dados dos pacientes apenas para prestar o serviço ao profissional, conforme as instruções dele.</li>
        <li><b>Auris (controlador dos dados de conta):</b> em relação aos dados de cadastro do próprio profissional (nome, e-mail, profissão, registro no conselho, dados de agenda e de pagamento do plano). O Auris é oferecido por 30.595.598 MORONI ELIAS SABAA DA SILVA SRUR, CNPJ 30.595.598/0001-70, Belém, PA.</li>
      </ul>

      <h2>2. Quais dados</h2>
      <ul>
        <li><b>Do profissional:</b> nome, e-mail, profissão, especialidade, registro no conselho, preferências, horários de agenda e a conexão com a instituição de pagamento que ele escolher. Para confirmar o cadastro, o Auris envia um código de 6 números ao e-mail informado.</li>
        <li><b>Do plano do profissional:</b> plano contratado, bandeira e 4 últimos números do cartão, histórico de cobranças, situação da assinatura e, se informado, o motivo do cancelamento. O número completo do cartão nunca é guardado pelo Auris.</li>
        <li><b>Do paciente:</b> nome, contato, CPF e idade quando informados, e as informações de saúde ditas no atendimento e registradas na ficha. Na teleconsulta, também o aceite do termo, a escolha sobre o assistente de IA e os dados do pagamento descritos abaixo.</li>
        <li><b>Do pagamento da teleconsulta:</b> o Auris guarda o valor, a forma de pagamento (Pix, crédito ou débito), a data e a hora da aprovação, o número da transação na instituição de pagamento, o status e, quando houver, a devolução e o motivo do cancelamento informado pelo paciente.</li>
        <li><b>Áudio:</b> usado apenas para gerar o texto da ficha e apagado depois da transcrição. O vídeo da teleconsulta não é gravado.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Transcrever o áudio e organizar a ficha para a revisão do profissional.</li>
        <li>Guardar o prontuário e os documentos da consulta para o profissional.</li>
        <li>Fazer a teleconsulta, o agendamento, os lembretes e a confirmação do pagamento.</li>
        <li>Manter a segurança do serviço e cumprir obrigações legais.</li>
      </ul>
      <p>O Auris não vende dados, não usa dados de pacientes para publicidade e não usa o conteúdo das fichas para treinar modelos de inteligência artificial.</p>

      <h2>4. Bases legais</h2>
      <p>Dados de saúde são tratados para a tutela da saúde, em procedimento realizado por profissional de saúde (LGPD, art. 11, II, &quot;f&quot;), e para o cumprimento de obrigação legal de manter o prontuário. Dados de conta são tratados para a execução do contrato com o profissional (art. 7º, V).</p>

      <h2>5. Com quem compartilhamos</h2>
      <p>Somente com fornecedores necessários para o serviço funcionar, que tratam os dados sob contrato e apenas para a finalidade indicada:</p>
      <ul>
        <li><b>Supabase:</b> banco de dados e arquivos, com servidores em São Paulo (Brasil).</li>
        <li><b>Vercel:</b> hospedagem do site.</li>
        <li><b>ElevenLabs:</b> transcrição do áudio em texto.</li>
        <li><b>Anthropic:</b> organização do texto nos campos da ficha.</li>
        <li><b>Mercado Pago (instituição de pagamento):</b> processa o pagamento e a devolução da teleconsulta, na conta do próprio profissional. Veja os detalhes no item 6 abaixo.</li>
        <li><b>Asaas (instituição de pagamento autorizada pelo Banco Central):</b> processa a cobrança do plano do Auris, na conta do Auris. Veja os detalhes no item 6 abaixo.</li>
        <li><b>PagBank (instituição de pagamento):</b> alternativa ao Mercado Pago para o pagamento da teleconsulta, quando o profissional escolhe essa instituição.</li>
        <li><b>Resend:</b> envio dos e-mails do Auris, como o código de confirmação do cadastro e a troca de senha.</li>
        <li><b>Meta (WhatsApp):</b> envio de lembretes de consulta, quando ativado.</li>
      </ul>
      <p>Alguns desses fornecedores processam dados fora do Brasil. Essa transferência ocorre para a execução do serviço contratado pelo profissional, com fornecedores que adotam padrões de segurança compatíveis com a LGPD (art. 33).</p>

      <h2>6. Dados de pagamento</h2>
      <ul>
        <li><b>Cartão da teleconsulta:</b> o número, a validade, o código de segurança e o nome do titular são digitados em um formulário seguro do Mercado Pago, que funciona dentro da página do Auris. Esses dados vão direto para o Mercado Pago e <b>nunca passam pelo Auris nem ficam guardados nele</b>. O Auris recebe apenas um código de uso único (token) para concluir a cobrança.</li>
        <li><b>E-mail e CPF do pagador</b> pedidos no pagamento com cartão passam pelo servidor do Auris apenas para serem enviados ao Mercado Pago junto com a cobrança. O Auris não os guarda.</li>
        <li><b>Cartão do plano do Auris:</b> o número, a validade, o código de segurança e o nome do titular do cartão, com o CPF, o CEP, o número do endereço e o celular do titular, são digitados no formulário do Auris. Esses dados passam pelo servidor do Auris, por conexão criptografada, <b>apenas para serem enviados ao Asaas</b>, e não são gravados nem registrados pelo Auris. O cartão fica guardado no Asaas para as cobranças mensais. O Auris guarda apenas a bandeira e os 4 últimos números, para mostrar em Finanças.</li>
        <li><b>Cartão de outra pessoa:</b> quando o profissional paga o plano com cartão de outra pessoa (cônjuge, familiar ou sócio), o nome, o CPF, o e-mail, o CEP, o número do endereço e o celular do titular são enviados ao Asaas junto com a cobrança, para aprovação e prevenção de fraudes. O Auris não guarda esses dados.</li>
        <li><b>Pix Automático do plano do Auris:</b> o CPF do profissional é enviado ao Asaas para gerar o Pix e a autorização de débito mensal. O Auris guarda apenas o identificador da autorização e a situação dela (ativa ou cancelada). Os dados da conta bancária ficam com o banco do profissional e com o Asaas.</li>
        <li><b>Pix:</b> o Auris não recebe dados da conta bancária de quem paga. O banco do paciente e o Mercado Pago tratam esses dados conforme as regras do Pix.</li>
        <li>O Mercado Pago e o Asaas tratam os dados de quem paga também como controladores, para processar o pagamento, prevenir fraudes e cumprir obrigações legais, conforme a política de privacidade de cada um.</li>
        <li><b>Bases legais:</b> execução do contrato de prestação do serviço (LGPD, art. 7º, V) e exercício regular de direitos, inclusive para comprovar pagamentos e devoluções em caso de reclamação (art. 7º, VI).</li>
      </ul>

      <h2>7. Por quanto tempo</h2>
      <ul>
        <li><b>Áudio:</b> apagado depois da transcrição.</li>
        <li><b>Prontuário:</b> guardado enquanto o profissional mantiver a conta. A lei pede guarda mínima de 20 anos (Lei nº 13.787/2018); por isso o profissional pode exportar todas as suas fichas a qualquer momento, em Perfil. Se a conta for encerrada, as fichas continuam disponíveis para exportação por 90 dias e depois são apagadas definitivamente.</li>
        <li><b>Registros de pagamento e devolução:</b> junto com o registro da consulta e, depois do encerramento da conta, pelo prazo necessário para comprovação fiscal e para defesa em eventual reclamação, em regra 5 anos.</li>
        <li><b>Dados de conta e do plano:</b> enquanto a conta existir e, depois do encerramento, pelo prazo exigido por lei e necessário para comprovação fiscal, em regra 5 anos.</li>
      </ul>

      <h2>8. Segurança</h2>
      <p>Conexões criptografadas, acesso de cada profissional restrito às próprias fichas, chaves de pagamento guardadas apenas no servidor e registros de acesso. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, os profissionais afetados e a Autoridade Nacional de Proteção de Dados serão comunicados, conforme a lei.</p>

      <h2>9. Seus direitos</h2>
      <p>A LGPD garante acesso, correção, informação sobre compartilhamento, portabilidade, eliminação quando cabível e revogação do consentimento, entre outros. Pacientes: falem com o profissional que os atendeu, que é quem responde pelo prontuário e pelos pagamentos da consulta. Profissionais: falem com o Auris pelo e-mail abaixo.</p>

      <h2>10. Contato</h2>
      <p>Dúvidas e pedidos sobre privacidade: <a href="mailto:contato@aurismed.com.br">contato@aurismed.com.br</a>.</p>
    </PaginaInfo>
  );
}
