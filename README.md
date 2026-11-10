# Ditado Clínico

Registro clínico por voz com IA para oftalmologia. O profissional dita o atendimento, a IA transcreve e preenche a ficha (paciente + grau de cada olho), o sistema confere os dados e o profissional revisa e aprova antes de salvar.

## Como funciona

1. **Gravar**: botão no navegador (celular ou computador).
2. **Transcrever**: ElevenLabs Scribe converte a fala em texto. O áudio não é armazenado.
3. **Estruturar**: Claude extrai os campos em formato fixo (tool use) e usa `null` para o que não foi dito.
4. **Validar**: CPF (dígitos verificadores), faixas de grau, múltiplos de 0,25, eixo de 0 a 180.
5. **Revisar e aprovar**: o profissional corrige o que for preciso. Nada é salvo sem aprovação.
6. **Métricas**: cada registro guarda o tempo de processamento e se houve correção, para medir precisão.

## Tecnologia

Next.js 16 (App Router) · Supabase (Postgres, Auth, Row Level Security) · Claude API · ElevenLabs Speech-to-Text · Vercel

## Segurança e LGPD

- Row Level Security: cada profissional acessa só os próprios registros.
- Chaves de API ficam apenas no servidor (variáveis de ambiente).
- O áudio é processado em memória e descartado.
- Use somente dados fictícios em testes e demonstrações.

## Instalação

1. **Supabase**: crie um projeto (região São Paulo). Em *SQL Editor*, rode `supabase/schema.sql`.
2. **Variáveis**: copie `.env.example` para `.env.local` e preencha (Supabase em *Project Settings > API*; chaves da Claude e da ElevenLabs).
3. **Rodar local**: `npm install` e `npm run dev`.
4. **Publicar**: importe o repositório na Vercel e cadastre as mesmas variáveis em *Settings > Environment Variables*.

## Próximas etapas

- Lembrete automático de retorno para o paciente (WhatsApp Business / SMS).
- Resumo da consulta em linguagem simples para o paciente.
- Receita digital com QR code.
- Novas especialidades por modelo de campos.
