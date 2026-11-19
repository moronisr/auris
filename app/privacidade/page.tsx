import PaginaInfo from "@/components/PaginaInfo";

export const metadata = { title: "Política de privacidade do Auris" };

export default function Privacidade() {
  return (
    <PaginaInfo titulo="Política de privacidade" atualizado="19 de novembro de 2026">
      <p>Esta política explica como o Auris trata dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).</p>

      <h2>1. Quem é quem</h2>
      <ul>
        <li><b>Profissional de saúde (controlador):</b> quem usa o Auris para registrar seus atendimentos decide quais dados dos pacientes são registrados e para quê. Pedidos de pacientes sobre seus dados de saúde devem ser feitos diretamente ao profissional que os atendeu.</li>
        <li><b>Auris (operador):</b> trata os dados dos pacientes apenas para prestar o serviço ao profissional, conforme as instruções dele.</li>
        <li><b>Auris (controlador dos dados de conta):</b> em relação aos dados de cadastro do próprio profissional (nome, e-mail, profissão, registro no conselho, dados de agenda e de pagamento).</li>
      </ul>

      <h2>2. Quais dados</h2>
      <ul>
        <li><b>Do profissional:</b> nome, e-mail, profissão, especialidade, registro no conselho, preferências, horários de agenda e a conexão com a instituição de pagamento que ele escolher.</li>
        <li><b>Do paciente:</b> nome, contato, CPF e idade quando informados, e as informações de saúde ditas no atendimento e registradas na ficha. Na teleconsulta, também o aceite do termo, a escolha sobre o assistente de IA e o status do pagamento.</li>
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
        <li><b>Mercado Pago ou PagBank:</b> pagamento da teleconsulta, na conta do próprio profissional. Os dados do cartão são digitados na página da instituição e não passam pelo Auris.</li>
        <li><b>Meta (WhatsApp):</b> envio de lembretes de consulta, quando ativado.</li>
      </ul>
      <p>Alguns desses fornecedores processam dados fora do Brasil. Essa transferência ocorre para a execução do serviço contratado pelo profissional, com fornecedores que adotam padrões de segurança compatíveis com a LGPD (art. 33).</p>

      <h2>6. Por quanto tempo</h2>
      <ul>
        <li><b>Áudio:</b> apagado depois da transcrição.</li>
        <li><b>Prontuário:</b> guardado enquanto o profissional mantiver a conta. A lei pede guarda mínima de 20 anos (Lei nº 13.787/2018); por isso o profissional pode exportar todas as suas fichas a qualquer momento, em Perfil.</li>
        <li><b>Dados de conta:</b> enquanto a conta existir e pelo prazo exigido por lei depois do encerramento.</li>
      </ul>

      <h2>7. Segurança</h2>
      <p>Conexões criptografadas, acesso de cada profissional restrito às próprias fichas, chaves de pagamento guardadas apenas no servidor e registros de acesso. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, os profissionais afetados e a Autoridade Nacional de Proteção de Dados serão comunicados, conforme a lei.</p>

      <h2>8. Seus direitos</h2>
      <p>A LGPD garante acesso, correção, informação sobre compartilhamento, portabilidade, eliminação quando cabível e revogação do consentimento, entre outros. Pacientes: falem com o profissional que os atendeu, que é quem responde pelo prontuário. Profissionais: falem com o Auris pelo e-mail abaixo.</p>

      <h2>9. Contato</h2>
      <p>Dúvidas e pedidos sobre privacidade: <a href="mailto:srurmoroni@gmail.com">srurmoroni@gmail.com</a>.</p>
    </PaginaInfo>
  );
}
