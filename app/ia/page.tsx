import PaginaInfo from "@/components/PaginaInfo";

export const metadata = { title: "Como a IA do Auris funciona" };

export default function PaginaIA() {
  return (
    <PaginaInfo titulo="Como a IA do Auris funciona" atualizado="19 de novembro de 2026">
      <section>
        <h2>Para você, paciente</h2>
        <p>O Auris é um assistente que ajuda o seu médico, dentista ou psicólogo a escrever o registro do atendimento. Assim, o profissional não precisa ficar digitando durante a conversa e pode dar toda a atenção a você.</p>
        <ul>
          <li><b>O que ele faz:</b> transforma o áudio da conversa em texto e organiza esse texto nos campos do prontuário.</li>
          <li><b>O que ele não faz:</b> não dá diagnóstico, não escolhe tratamento e não fala com você. Quem avalia, decide e conversa é sempre o profissional.</li>
          <li><b>Revisão:</b> o profissional lê, corrige e aprova tudo antes de salvar.</li>
          <li><b>Privacidade:</b> o vídeo da teleconsulta não é gravado. O áudio é apagado logo depois de virar texto. O registro fica protegido pelo sigilo profissional.</li>
          <li><b>Sua escolha:</b> se preferir que o assistente não seja usado, é só dizer ao profissional ou escolher &quot;Prefiro sem&quot; no link da teleconsulta. O atendimento é exatamente o mesmo.</li>
        </ul>
      </section>
      <section>
        <h2>Para você, profissional</h2>
        <h3>Finalidade</h3>
        <p>Apoio administrativo à documentação clínica: transcrição do áudio (ditado ou conversa) e organização do conteúdo em um modelo de ficha da sua área. O Auris não oferece apoio à decisão diagnóstica ou terapêutica.</p>
        <h3>Como funciona</h3>
        <ol>
          <li>O áudio é gravado no seu aparelho e enviado por conexão segura.</li>
          <li>Um serviço de transcrição de voz converte o áudio em texto, separando quem fala.</li>
          <li>Um modelo de linguagem organiza o texto nos campos da ficha, seguindo instruções fixas: usar apenas o que foi dito, não inventar dados e deixar em branco o que não foi mencionado.</li>
          <li>Você revisa, corrige e aprova. Só depois a ficha é salva.</li>
          <li>O áudio é apagado depois da transcrição.</li>
        </ol>
        <h3>Limitações e riscos</h3>
        <ul>
          <li>A transcrição pode errar palavras, nomes, números e doses, principalmente com ruído, sotaques fortes ou falas sobrepostas.</li>
          <li>O modelo pode resumir de forma incompleta ou colocar uma informação no campo errado.</li>
          <li>Por isso a revisão do profissional é obrigatória antes de salvar, e a responsabilidade pelo conteúdo do prontuário é sempre de quem assina.</li>
        </ul>
        <h3>Nível de risco</h3>
        <p>Pela finalidade (documentação, sem influência direta em diagnóstico ou tratamento), o Auris se enquadra no que a Resolução CFM nº 2.454/2026 descreve como baixo risco. Essa é a avaliação do próprio Auris; cabe a cada profissional e instituição fazer a sua.</p>
        <h3>Transparência com o paciente</h3>
        <ul>
          <li>Na teleconsulta, o paciente lê o termo e escolhe se o assistente pode ser usado.</li>
          <li>No presencial, você confirma que combinou com o paciente antes de gravar.</li>
          <li>Em toda ficha fica registrado que ela foi elaborada com apoio de IA e revisada por você.</li>
        </ul>
        <h3>Dados</h3>
        <p>Os dados são guardados no Brasil (São Paulo). O áudio passa por serviços de transcrição e de organização de texto contratados pelo Auris, que processam o conteúdo apenas para executar a tarefa. Detalhes na <a href="/privacidade">Política de privacidade</a>.</p>
      </section>
    </PaginaInfo>
  );
}
