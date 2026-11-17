// Termos de Uso, Política de Privacidade e Condições do plano Cedro do MDSign.
//
// Texto aprovado pelo Jurídico (pacote 01 a 03, recebido em 17/11/2026), vigente a partir de
// 17/11/2026. Exceções decididas pela responsável em 17/11/2026:
// - Termos, seção 8: lista de planos e preços da matriz vigente (lancamento_2026_11), no lugar da
//   tabela antiga que constava no documento;
// - Privacidade, seção 14: mantida a indicação do formulário "Seus dados (LGPD)" (/pt/titular).
// A versão oficial é a em português; en/es mostram o mesmo texto com um aviso.
// Mudou o texto? Atualize LEGAL_VERSION (gravada no aceite do cadastro) e a data de vigência.

import type { Locale } from "@/i18n";

export const LEGAL_DRAFT = false;
/** Mesma versão gravada no aceite do cadastro (src/routes/app/signup.tsx). */
export const LEGAL_VERSION = "2026-11";

export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDoc = {
  title: string;
  metaDescription: string;
  version: string;
  sections: LegalSection[];
};
export type LegalKind = "terms" | "privacy" | "cedro";

export const legalUi: Record<
  Locale,
  { draftNotice: string; versionLabel: string; ptOnly: string | null }
> = {
  pt: {
    draftNotice:
      "Minuta em revisão jurídica. O texto final pode mudar; em caso de dúvida, fale com contato@mundodigitaltech.com.br.",
    versionLabel: "Versão",
    ptOnly: null,
  },
  en: {
    draftNotice:
      "Draft under legal review. The final text may change; if in doubt, contact contato@mundodigitaltech.com.br.",
    versionLabel: "Version",
    ptOnly:
      "This document is available in Portuguese only. The Portuguese version is the official one.",
  },
  es: {
    draftNotice:
      "Borrador en revisión jurídica. El texto final puede cambiar; ante dudas, escriba a contato@mundodigitaltech.com.br.",
    versionLabel: "Versión",
    ptOnly:
      "Este documento está disponible solo en portugués. La versión en portugués es la oficial.",
  },
};

const terms: LegalDoc = {
  title: "Termos de Uso",
  metaDescription: "Termos de Uso da plataforma de assinatura eletrônica MDSign.",
  version: "3.0 — vigente a partir de 17/11/2026",
  sections: [
    {
      title: "1. Identificação, alcance e aceite",
      paragraphs: [
        "O MDSign é uma plataforma de gestão e assinatura eletrônica de documentos oferecida por Mundo Digital Tecnologia da Informação Ltda. — CNPJ 32.650.036/0001-07 (“MDTech”, “nós”). O nome comercial SignDoc passa a ser MDSign. Estes Termos disciplinam o acesso e uso da plataforma, inclusive por clientes, administradores, usuários convidados e signatários externos, naquilo que lhes for aplicável.",
        "O cliente manifesta aceite por ação afirmativa no cadastro ou contratação. Signatários externos recebem informações e condições próprias do fluxo de assinatura, sem obrigação de criar conta quando a funcionalidade permitir. A plataforma registra a versão aceita, data, horário e identificação técnica adequada.",
        "A pessoa que contratar ou administrar a plataforma em nome de pessoa jurídica declara possuir os poderes necessários para representá-la e autorizar as operações realizadas em seu nome. O cliente deverá manter atualizadas as informações de seus representantes e administradores e comunicar prontamente alterações ou comprometimento de acessos.",
        "Integram a contratação a proposta ou instrumento empresarial específico, quando existente, as condições do plano contratado e estes Termos. Em caso de conflito, prevalecerão, nessa ordem e exclusivamente quanto às matérias expressamente disciplinadas, as condições especificamente negociadas, as condições do plano e estes Termos, respeitadas as disposições legais obrigatórias. A Política de Privacidade informa o tratamento de dados pessoais e não constitui autorização genérica para utilização dos dados.",
      ],
    },
    {
      title: "2. Definições",
      paragraphs: [
        "Cliente: pessoa física ou jurídica titular de uma conta ou organização. Usuário autorizado: pessoa habilitada pelo cliente com permissões definidas. Signatário: destinatário convidado para assinar ou participar de um fluxo. Documento: arquivo enviado, gerado ou processado na plataforma. Operação consumível: evento contabilizado conforme as regras do plano informadas ao cliente antes da operação.",
        "Organização: ambiente lógico de usuários e documentos sob administração do cliente. Plano: conjunto de recursos, limites, condições de pagamento e retenção aplicáveis. Evidências de assinatura: registros técnicos associados à operação, conforme a modalidade utilizada.",
      ],
    },
    {
      title: "3. Serviços e disponibilidade",
      paragraphs: [
        "O MDSign pode oferecer criação, envio, recebimento, assinatura eletrônica, modelos, formulários, fluxos, acompanhamento, gestão e armazenamento de documentos, conforme o plano e a disponibilidade efetiva de cada recurso. Recursos de integração, API, automações, envio em massa e modalidades específicas podem depender de contratação ou habilitação adicional.",
        "A contratação compreende exclusivamente os recursos identificados na oferta aceita pelo cliente. Funcionalidades anunciadas como futuras, experimentais ou sujeitas a contratação adicional não integram o serviço contratado, salvo previsão expressa. A MDTech poderá realizar atualizações e manutenções, preservadas as funcionalidades essenciais contratadas e observadas as regras de comunicação e alteração destes Termos.",
        "A MDTech empregará medidas técnicas e organizacionais proporcionais para operação e manutenção. Interrupções programadas, emergenciais ou decorrentes de terceiros poderão ocorrer; compromissos de nível de serviço somente existirão quando expressamente previstos em contratação específica.",
        "A ausência de compromisso específico de nível de serviço não afasta o dever de prestação adequada. A responsabilidade por indisponibilidades será apurada conforme sua causa, duração, efeitos e as obrigações assumidas, não constituindo a simples participação de fornecedor integrado causa automática de exclusão de responsabilidade.",
        "O limite técnico para envio individual é de 20 MB por PDF; o processamento em lote admite até 1.000 destinatários/linhas, conforme a funcionalidade habilitada. Recursos e limites podem variar por plano.",
      ],
    },
    {
      title: "4. Cadastro, elegibilidade e credenciais",
      paragraphs: [
        "O titular deve fornecer informações verdadeiras, atualizadas e necessárias à operação. A criação de conta é destinada a pessoas com capacidade legal para contratar ou devidamente representadas. O cliente deve proteger credenciais, controlar permissões e comunicar suspeitas de uso indevido.",
        "A MDTech pode adotar mecanismos proporcionais de verificação, segurança, prevenção de abuso e autenticação. A criação de múltiplas contas com finalidade de contornar limites gratuitos constitui uso indevido, sujeita a apuração e medidas proporcionais.",
      ],
    },
    {
      title: "5. Organizações e usuários",
      paragraphs: [
        "O administrador designado pelo cliente gerencia convites, acessos e permissões nos limites do plano. O cliente responde pela autorização e legitimidade do acesso concedido a colaboradores e terceiros, sem prejuízo das responsabilidades legais próprias da MDTech.",
        "O cliente deverá revogar acessos de pessoas que deixem de estar autorizadas. A substituição do administrador ou a recuperação de acesso poderá exigir comprovação dos poderes de representação e da titularidade da organização, conforme procedimento de segurança informado pela MDTech.",
        "A segregação lógica de dados entre organizações e as permissões de acesso devem observar os controles efetivamente implementados.",
      ],
    },
    {
      title: "6. Assinaturas eletrônicas e validade",
      paragraphs: [
        "O MDSign prevê assinaturas eletrônicas simples, avançadas e qualificadas (ICP-Brasil), conforme a modalidade contratada e os recursos efetivamente habilitados. Podem ser utilizados links autenticados, fatores adicionais como OTP, verificações de identidade e certificados digitais, conforme disponibilidade e homologação de cada fluxo. A escolha da modalidade deve observar a legislação e a natureza do documento.",
        "Cabe ao cliente avaliar a modalidade exigida por lei, contrato, órgão destinatário ou natureza do ato. A MDTech não é parte, testemunha ou garantidora do negócio jurídico documentado, salvo ajuste expresso em contrário. Não se promete aceitação universal de toda modalidade por qualquer destinatário.",
        "Salvo funcionalidade expressamente contratada, a MDTech não realiza análise jurídica dos documentos, não verifica os poderes de representação dos signatários e não assegura o cumprimento de formalidades externas ao procedimento eletrônico, como reconhecimento, registro ou instrumento público. Compete ao cliente conferir o conteúdo, os destinatários, os poderes de representação e a adequação da modalidade de assinatura ao ato pretendido, sem prejuízo da responsabilidade da MDTech pelas verificações e funcionalidades que expressamente oferecer.",
        "A utilização da plataforma não atribui, por si só, força executiva ao documento nem assegura sua aceitação por qualquer órgão ou destinatário. A eficácia do documento dependerá dos requisitos legais aplicáveis, de seu conteúdo e das evidências produzidas no procedimento.",
      ],
    },
    {
      title: "7. Documentos, evidências, armazenamento e retenção",
      paragraphs: [
        "O cliente é responsável pela licitude, exatidão e autorização para tratamento do conteúdo enviado, inclusive dados de terceiros. A MDTech executa as operações técnicas contratadas e adota medidas de proteção adequadas.",
        "O encerramento da conta inicia o prazo de 30 (trinta) dias para exportação dos documentos e comprovantes disponibilizados pela plataforma. Até o 60º (sexagésimo) dia, serão eliminados dos ambientes ativos os dados operacionais dispensáveis à continuidade das finalidades legítimas de tratamento. Documentos assinados e registros necessários à comprovação de autoria, integridade e realização dos procedimentos poderão ser conservados, com acesso restrito, pelos prazos aplicáveis às respectivas finalidades, conforme informado na Política de Privacidade.",
        "A disponibilidade de documentos criados no plano Cedro termina 6 (seis) meses após sua criação, independentemente de exclusão física.",
        "O encerramento da assinatura ou do plano não implica, por si só, destruição imediata de documentos ou evidências cuja conservação seja necessária e juridicamente fundamentada. As evidências essenciais de assinatura serão conservadas por 5 (cinco) anos após a conclusão do procedimento, ressalvados prazos específicos aplicáveis à categoria documental e a necessidade fundamentada de preservação por obrigação legal ou exercício regular de direitos. A conservação após o encerramento não implica manutenção das funcionalidades da conta ou disponibilidade permanente no painel. Permanecem assegurados o atendimento de obrigações legais, ordens de autoridade competente e solicitações legalmente cabíveis. Dados biométricos brutos e selfies terão prazos específicos conforme sua necessidade e finalidade.",
        "O cliente deverá exportar e conservar seus documentos e comprovantes pelo período necessário às suas atividades e obrigações, sem prejuízo dos deveres de armazenamento e preservação expressamente assumidos pela MDTech.",
      ],
    },
    {
      title: "8. Planos e franquias",
      paragraphs: [
        "Cedro: gratuito, 1 usuário, franquia total de 5 documentos por pessoa (somando as organizações no plano gratuito), não renovada mensalmente e sem exigência de cartão de crédito. Os demais planos são Jacarandá (R$ 39,90/mês; 50 documentos/mês; 1 usuário), Ipê (R$ 99,97/mês; documentos ilimitados; até 4 usuários) e Mogno (sob proposta e contrato).",
        "“Ilimitado” refere-se à franquia de documentos, sem afastar regras de uso aceitável e limites técnicos razoáveis. Para planos sujeitos a franquia, cada documento consome uma unidade no momento da criação; cancelamento, recusa ou exclusão posterior não restituem essa unidade. Falhas técnicas que impeçam a criação do documento não consomem a franquia.",
        "O evento que caracteriza a criação e o consumo da franquia será informado de maneira clara antes da operação. Consumos duplicados ou indevidos decorrentes de falha imputável à plataforma serão corrigidos, mediante identificação da ocorrência. Eventuais limites de armazenamento, processamento simultâneo, integrações ou serviços acessórios serão informados antes da contratação. As regras de uso aceitável não poderão ser utilizadas para impor franquia de documentos incompatível com a oferta contratada.",
        "Valores e ofertas vigentes devem ser exibidos antes da contratação, com impostos e condições aplicáveis, sem prejuízo das condições de contratos empresariais já firmados.",
      ],
    },
    {
      title: "9. Contratação, pagamento e renovação",
      paragraphs: [
        "Os planos pagos renovam-se automaticamente a cada mês, com vencimento no dia correspondente à contratação, observadas as regras de calendário e as condições informadas no checkout. As formas de pagamento previstas são cartão e Pix recorrente, quando efetivamente habilitadas.",
        "Os valores contratados poderão ser reajustados a cada período de 12 (doze) meses, contado da contratação ou do último reajuste, pela variação do IPCA/IBGE, mediante comunicação prévia de 30 (trinta) dias. A alteração comercial do preço do plano, distinta do reajuste monetário, produzirá efeitos apenas para ciclos futuros, mediante informação prévia e possibilidade de cancelamento antes da cobrança do novo valor, respeitadas as condições especificamente negociadas.",
        "Em caso de inadimplência, haverá tolerância de 7 (sete) dias corridos após o vencimento antes de eventual suspensão de funcionalidades, observadas as comunicações cabíveis. Em seguida poderão ser bloqueadas novas operações, preservando-se o acesso aos documentos conforme as regras aplicáveis.",
      ],
    },
    {
      title: "10. Alteração de plano, suspensão e cancelamento",
      paragraphs: [
        "Nos planos pagos, o cancelamento da renovação solicitado pelo cliente impede a próxima renovação automática e mantém o acesso às funcionalidades contratadas até o término do período já pago, ressalvadas suspensões justificadas por fraude, segurança ou determinação legal. Não há reembolso contratual voluntário de períodos pagos, ressalvados direito de arrependimento, estornos e demais direitos previstos em lei. O encerramento da conta constitui solicitação distinta e inicia a janela de 30 dias para recuperação dos documentos, conforme a seção 7. A simples solicitação de não renovação não antecipa o término do período contratado nem inicia, por si só, o prazo de exportação decorrente do encerramento.",
        "O cliente poderá solicitar alteração ou cancelamento pelos canais disponibilizados. Efeitos financeiros, eventual proporcionalidade, data de mudança e política de reembolso devem ser informados antes da contratação e observar a legislação aplicável, inclusive direitos do consumidor quando incidentes.",
        "A solicitação de cancelamento ou encerramento não ficará condicionada à realização prévia de download. O cliente será informado sobre a conveniência da exportação e sobre os prazos aplicáveis, com registro de sua ciência.",
        "Quando aplicável o direito de arrependimento previsto na legislação de consumo, o cliente poderá exercê-lo no prazo legal de 7 (sete) dias, contado da contratação ou do recebimento do serviço, conforme o caso, pelos canais de atendimento disponibilizados, com confirmação de recebimento e restituição dos valores nos termos legais.",
        "Na inadimplência, poderá haver restrição proporcional de novas operações, após comunicações cabíveis, preservados os direitos legais e a política de acesso/exportação. Não haverá exclusão automática de documentos exclusivamente por atraso no pagamento.",
        "Persistindo a inadimplência após a suspensão, a MDTech poderá encerrar a contratação mediante notificação com antecedência mínima de 15 (quinze) dias, assegurada oportunidade de regularização e exportação. O encerramento não afasta valores legitimamente devidos e observará as regras de retenção aplicáveis.",
        "A MDTech poderá restringir ou suspender o acesso diante de fraude, risco de segurança, violação grave destes Termos ou determinação legal, observando proporcionalidade e possibilidade de correção quando cabível.",
      ],
    },
    {
      title: "11. Uso aceitável",
      paragraphs: [
        "É proibido usar a plataforma para atos ilícitos, violação de direitos de terceiros, fraude, envio abusivo de mensagens, tentativa de acesso não autorizado, malware, engenharia de contorno de franquias ou automação não autorizada.",
        "O cliente deverá assegurar base legítima para compartilhar dados de signatários e evitar comunicações não solicitadas.",
      ],
    },
    {
      title: "12. Responsabilidades e limitações",
      paragraphs: [
        "A MDTech responde pelas obrigações que lhe cabem nos termos da lei e do contrato, inclusive quanto à prestação do serviço e segurança sob seu controle. O cliente responde pela origem, conteúdo, destinatários, autorizações e adequação jurídica dos documentos que submete.",
        "Nenhuma cláusula exclui responsabilidade que não possa ser afastada pela legislação aplicável, nem direitos irrenunciáveis de consumidores ou titulares de dados. A MDTech não responde por fatos exclusivamente atribuíveis ao cliente ou a terceiros quando comprovados os pressupostos legais pertinentes.",
        "O cliente responderá pelos prejuízos comprovadamente decorrentes de conteúdo ilícito, ausência de autorização para utilização de documentos ou dados, indicação incorreta de destinatários e utilização da plataforma em desacordo com a lei ou com estes Termos, na medida de sua responsabilidade. Eventual ressarcimento à MDTech dependerá da demonstração do prejuízo e do nexo causal, asseguradas comunicação da reclamação e oportunidade razoável de participação na defesa.",
      ],
    },
    {
      title: "13. Proteção de dados e confidencialidade",
      paragraphs: [
        "O tratamento de dados pessoais observará a LGPD e a Política de Privacidade MDSign. Os papéis de controlador e operador serão definidos conforme a finalidade concreta: a MDTech pode atuar como controladora de dados cadastrais, faturamento e segurança e como operadora em operações documentais realizadas sob instrução do cliente, sem prejuízo de situações específicas.",
        "Dados e documentos serão tratados com confidencialidade, observadas autorizações legítimas, obrigações legais, segurança, suporte autorizado e exercício regular de direitos.",
        "O acesso ao conteúdo dos documentos ficará limitado às pessoas e aos fornecedores que necessitem conhecê-lo para execução do serviço, suporte autorizado, segurança ou atendimento de obrigação legal, sujeitos a deveres de confidencialidade compatíveis. A obrigação de confidencialidade subsistirá ao encerramento da contratação enquanto a informação conservar natureza confidencial.",
      ],
    },
    {
      title: "14. Propriedade intelectual e integrações",
      paragraphs: [
        "A plataforma, sua interface, código, marcas e materiais são protegidos por direitos de propriedade intelectual da MDTech ou de licenciantes. O cliente mantém os direitos que possua sobre seus documentos e autoriza seu processamento exclusivamente na extensão necessária à execução do serviço e às finalidades legitimamente informadas. Essa autorização não transfere a titularidade do conteúdo nem autoriza sua exploração comercial autônoma.",
        "A contratação concede licença de uso limitada, não exclusiva e restrita ao período, às funcionalidades e aos usuários autorizados do plano. É vedado reproduzir ou explorar comercialmente a plataforma, contornar seus mecanismos de proteção ou realizar engenharia reversa fora das hipóteses legalmente permitidas.",
        "Integrações de terceiros poderão estar sujeitas a condições adicionais divulgadas previamente.",
      ],
    },
    {
      title: "15. Suporte e comunicações",
      paragraphs: [
        "Canal de privacidade e suporte: contato@mundodigitaltech.com.br. Endereço institucional: SCS, Quadra 01, Bloco K, Sala 1103, Asa Sul, Brasília/DF, Brasil. Horários e canais adicionais serão divulgados na plataforma.",
        "Avisos relevantes poderão ser encaminhados ao e-mail cadastrado ou exibidos na plataforma. O cliente deve manter contatos atualizados.",
      ],
    },
    {
      title: "16. Alterações dos termos",
      paragraphs: [
        "Alterações contratuais relevantes serão comunicadas, como regra, com antecedência de 30 (trinta) dias, ressalvadas medidas urgentes de segurança, determinações legais e hipóteses justificadas. Versões e datas de vigência serão identificadas; novo aceite será solicitado quando necessário.",
        "Alterações materiais não reduzirão retroativamente direitos relativos a períodos já contratados. Quando modificarem substancialmente as condições de continuidade do serviço, será assegurada ao cliente oportunidade de cancelamento antes de sua aplicação.",
      ],
    },
    {
      title: "17. Disposições finais e solução de conflitos",
      paragraphs: [
        "Aplica-se a legislação brasileira. A solução de controvérsias buscará inicialmente canais de atendimento e mecanismos consensuais, sem restringir direitos legais de acesso ao Judiciário, competência territorial ou proteção do consumidor.",
        "Nas relações empresariais em que a eleição de foro seja legalmente admissível, fica eleito o foro de Brasília/DF, local da sede da MDTech, preservadas as competências obrigatórias e os direitos assegurados ao consumidor.",
        "A nulidade de uma disposição não invalida as demais. Esta versão substitui o texto legado apenas após aprovação, publicação e procedimentos de comunicação aplicáveis.",
        "A MDTech poderá descontinuar o serviço mediante comunicação com antecedência mínima de 60 (sessenta) dias, assegurando meios de exportação durante o período e restituição proporcional dos valores antecipadamente pagos por serviços que não serão prestados. Determinações legais e situações emergenciais poderão exigir prazo inferior, com adoção das medidas de transição razoavelmente possíveis.",
      ],
    },
  ],
};

const privacy: LegalDoc = {
  title: "Política de Privacidade",
  metaDescription:
    "Como o MDSign trata dados pessoais de clientes, signatários e visitantes, conforme a LGPD.",
  version: "1.0 — vigente a partir de 17/11/2026",
  sections: [
    {
      title: "1. Quem somos",
      paragraphs: [
        "Esta Política explica como Mundo Digital Tecnologia da Informação Ltda., CNPJ 32.650.036/0001-07, responsável pela marca MDSign, trata dados pessoais relacionados à plataforma. Endereço institucional: SCS, Quadra 01, Bloco K, Sala 1103, Asa Sul, Brasília/DF, Brasil. Contato de privacidade: contato@mundodigitaltech.com.br.",
      ],
    },
    {
      title: "2. Categorias de titulares",
      paragraphs: [
        "Clientes e representantes de organizações; usuários autorizados; signatários externos; visitantes do site; leads de campanhas; contatos de suporte e fornecedores, conforme a relação concreta.",
      ],
    },
    {
      title: "3. Dados tratados",
      paragraphs: [
        "Cadastro e conta: nome, e-mail, telefone, CPF quando necessário, organização, credenciais protegidas e preferências.",
        "Assinaturas e documentos: dados incluídos nos arquivos, identificação de participantes, registros de autenticação, eventos, horários e evidências técnicas pertinentes.",
        "Dados técnicos e de segurança: IP, dispositivo, navegador, logs, identificadores de sessão e sinais proporcionais de prevenção a fraude.",
        "Dados comerciais: plano, consumo, histórico de contratação, pagamentos e informações financeiras necessárias, conforme o meio de cobrança efetivamente utilizado.",
        "Marketing e aquisição: origem de campanha, parâmetros UTM, interações na landing, preferências e autorizações de comunicação.",
        "O conteúdo de documentos pode conter dados sensíveis inseridos pelo cliente. O MDSign não deve solicitar dados além dos necessários à finalidade concreta.",
      ],
    },
    {
      title: "4. Finalidades e bases legais",
      paragraphs: [
        "Criar e manter contas; executar fluxos documentais; autenticar signatários; fornecer suporte; cumprir obrigações legais; prevenir fraudes; proteger sistemas; realizar cobranças; mensurar desempenho e melhorar a experiência; enviar comunicações comerciais quando houver base legal adequada.",
        "As bases legais variam conforme a operação, podendo incluir execução de contrato, cumprimento de obrigação legal/regulatória, exercício regular de direitos, legítimo interesse sujeito a avaliação aplicável e consentimento quando necessário. Não se presume que todo tratamento depende de consentimento.",
        "Quando houver tratamento de dados pessoais sensíveis, inclusive biometria utilizada para identificação, será observada a hipótese legal específica aplicável à operação, não se estendendo automaticamente a esses dados as bases previstas para dados pessoais comuns.",
      ],
    },
    {
      title: "5. Papéis de controlador e operador",
      paragraphs: [
        "A MDTech geralmente atua como controladora dos dados necessários à administração de contas, segurança, faturamento e relacionamento comercial. Em fluxos documentais iniciados por clientes organizacionais, pode atuar como operadora dos dados tratados sob instruções do cliente, que determina as finalidades do documento.",
        "A qualificação concreta depende das decisões efetivas sobre finalidade e meios essenciais, podendo exigir acordo de tratamento de dados específico com clientes empresariais.",
        "Quando atuar como operadora, a MDTech tratará os dados segundo instruções documentadas do cliente controlador, compreendidas na contratação e nas configurações legitimamente realizadas na plataforma. O cliente deverá assegurar fundamento jurídico para as operações que determinar. A MDTech permanecerá responsável pelas obrigações que legalmente lhe incumbam e por tratamentos realizados para finalidades próprias.",
      ],
    },
    {
      title: "6. Compartilhamento e operadores",
      paragraphs: [
        "O MDSign utiliza Lovable/Cloudflare Workers para aplicação e distribuição; Supabase (PostgreSQL, Auth, Storage e Edge Functions) para dados e backend; o motor SignDoc (Lacuna Software) para fluxos de assinatura; e o Asaas para processamento financeiro, quando a integração for ativada em produção. Outros fornecedores de mensageria, identidade e biometria serão identificados conforme seu uso efetivo.",
      ],
    },
    {
      title: "7. Cookies, analytics e campanhas",
      paragraphs: [
        "A aplicação utiliza o cookie funcional mdsign_lang para o idioma; armazenamento local para a sessão de acesso; sessionStorage para parâmetros UTM e para um identificador de sessão usado na contagem de visitas; e eventos próprios enviados à camada dataLayer. Há integração condicional com Google Tag Manager (GTM), cujo contêiner pode carregar outras tags conforme configuração. Tags não essenciais (análise e marketing) só são carregadas depois do consentimento, dado no aviso de cookies; o Google Consent Mode começa negado. As preferências podem ser revistas a qualquer momento em “Preferências de cookies”, no rodapé do site.",
        "Não serão enviados a plataformas publicitárias CPF, conteúdo documental, dados sensíveis ou informações pessoais desnecessárias.",
      ],
    },
    {
      title: "8. Marketing e preferências",
      paragraphs: [
        "Comunicações operacionais necessárias à prestação do serviço são distintas de publicidade. O recebimento de campanhas e ofertas será baseado em fundamento jurídico apropriado, com informação clara e opção de descadastro ou oposição conforme aplicável. O aceite dos Termos não equivale a aceite de marketing.",
      ],
    },
    {
      title: "9. Armazenamento, segurança e incidentes",
      paragraphs: [
        "Adotamos controles técnicos e organizacionais compatíveis com os riscos, como gestão de acessos, segregação de ambientes, registros de auditoria e proteção de dados, conforme implementação efetiva. Nenhum ambiente é absolutamente imune a riscos.",
        "Incidentes serão avaliados e comunicados aos titulares e à ANPD quando legalmente exigível, considerando a legislação e regulamentação vigente.",
        "Quando atuar como operadora, a MDTech comunicará ao controlador, sem demora injustificada, incidentes que afetem os dados tratados em seu nome e cooperará com as providências cabíveis, sem prejuízo das obrigações próprias que lhe sejam aplicáveis.",
      ],
    },
    {
      title: "10. Retenção e eliminação",
      paragraphs: [
        "Os dados são conservados pelo período necessário às finalidades declaradas, obrigações legais, preservação de evidências e exercício regular de direitos. Após esse período, serão eliminados ou anonimizados quando cabível.",
        "No plano Cedro, o acesso aos documentos encerra-se 6 (seis) meses após cada criação, sem que isso represente necessariamente eliminação física. Após o encerramento da conta, haverá 30 (trinta) dias para exportação dos documentos e comprovantes disponibilizados pela plataforma. Até o 60º dia, serão eliminados dos ambientes ativos os dados operacionais dispensáveis às finalidades legítimas remanescentes, ressalvada a conservação fundamentada de documentos e evidências.",
        "As evidências essenciais de assinatura serão conservadas por 5 (cinco) anos após a conclusão do procedimento, ressalvados prazos específicos aplicáveis à categoria documental e a necessidade fundamentada de preservação por obrigação legal ou exercício regular de direitos. A conservação de documentos assinados e evidências observará a finalidade juridicamente fundamentada e o acesso restrito, podendo ser prolongada diante de litígio ou ordem de preservação. Dados biométricos brutos e selfies terão prazos específicos definidos por necessidade e finalidade, não sendo automaticamente abrangidos pelos cinco anos. Dados fiscais, financeiros, registros de acesso e backups observarão critérios próprios de retenção e expurgo.",
        "O término da disponibilidade contratual no painel não equivale necessariamente à eliminação dos dados. A conservação residual não autoriza reutilização para finalidade incompatível. A eliminação alcançará os fornecedores envolvidos conforme suas obrigações e os ciclos de descarte aplicáveis.",
      ],
    },
    {
      title: "11. Transferência internacional",
      paragraphs: [
        "O uso de infraestrutura global Cloudflare e Supabase/AWS pode envolver processamento e transferência internacional de dados. As transferências dependerão de mecanismo válido nos termos do art. 33 da LGPD e da regulamentação da ANPD, compatível com o fluxo realizado. A publicação desta Política e o aceite dos Termos não substituem a implementação do mecanismo aplicável.",
      ],
    },
    {
      title: "12. Direitos dos titulares",
      paragraphs: [
        "O titular poderá solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação quando cabíveis, portabilidade, informação sobre compartilhamento e demais direitos previstos na LGPD. Pedidos poderão exigir verificação de identidade.",
        "Quando a MDTech atuar como operadora, poderá encaminhar a solicitação ao cliente controlador e cooperar com sua resposta, conforme obrigações aplicáveis.",
        "O atendimento observará a proteção dos dados de terceiros e dos segredos comercial e industrial. Solicitações relacionadas a documentos poderão exigir análise do papel da MDTech e do cliente, não implicando disponibilização irrestrita de conteúdo documental. Quando atuar como operadora, a MDTech auxiliará o controlador no atendimento das obrigações aplicáveis.",
      ],
    },
    {
      title: "13. Menores de idade",
      paragraphs: [
        "O uso da conta deverá observar capacidade legal e regras de representação. Eventuais dados de crianças e adolescentes incluídos em documentos serão tratados conforme a legislação e o melhor interesse aplicável.",
      ],
    },
    {
      title: "14. Contato e atualizações",
      paragraphs: [
        "Para exercer direitos relacionados a dados pessoais, use o formulário “Seus dados (LGPD)”, no rodapé do site (endereço /pt/titular), que gera um protocolo com prazo de resposta, ou escreva para contato@mundodigitaltech.com.br. Esta Política poderá ser atualizada, com indicação de versão e data e comunicação quando necessária.",
      ],
    },
  ],
};

const cedro: LegalDoc = {
  title: "Condições do plano Cedro",
  metaDescription:
    "Regras do plano gratuito Cedro do MDSign: 5 documentos no total, sem cartão de crédito.",
  version: "1.0 — vigente a partir de 17/11/2026",
  sections: [
    {
      title: "O que está incluído",
      paragraphs: [
        "O Cedro é o plano gratuito de entrada do MDSign, disponibilizado pela Mundo Digital Tecnologia da Informação Ltda. (CNPJ 32.650.036/0001-07).",
        "Preço: R$ 0. Franquia: 5 documentos no total por pessoa, somando as organizações no plano gratuito; não se renova a cada mês. Usuários incluídos: 1. Não exige cartão de crédito para criação da conta. Recursos disponíveis conforme a configuração efetiva do Cedro no MDSign.",
      ],
    },
    {
      title: "Quando um documento é consumido",
      paragraphs: [
        "Cada documento criado consome uma unidade da franquia no momento de sua criação. Documentos posteriormente cancelados, recusados ou excluídos continuam contabilizados e não restituem a unidade utilizada. Tentativas que não chegam a gerar o documento, por falha técnica, não consomem a franquia.",
        "O evento que caracteriza a criação e o consumo da franquia será informado de maneira clara antes da operação. Consumos duplicados ou indevidos decorrentes de falha imputável à plataforma serão corrigidos, mediante identificação da ocorrência.",
        "A exclusão de documento não recupera a franquia consumida.",
      ],
    },
    {
      title: "Ao utilizar os cinco documentos",
      paragraphs: [
        "Ao atingir a franquia, novas operações consumíveis ficam indisponíveis no Cedro. O usuário poderá avaliar a contratação de um plano pago para continuar.",
        "Cada documento criado no Cedro permanece disponível para consulta e exportação por 6 (seis) meses a partir de sua criação, com a data indicada no painel. Encerrado esse prazo, termina a disponibilidade ao usuário, sem implicar eliminação física imediata nem afastar a conservação legítima de evidências de assinatura. Se a organização passar para um plano pago, o acesso aos documentos é restabelecido. Se a conta for encerrada antes desse prazo, haverá 30 dias para exportação dos documentos e comprovantes disponibilizados pela plataforma. Até o 60º dia, serão eliminados dos ambientes ativos os dados operacionais dispensáveis às finalidades legítimas remanescentes, ressalvada a conservação fundamentada de documentos e evidências, conforme os Termos e a Política de Privacidade.",
        "O encerramento da disponibilidade aos seis meses não renova a franquia de cinco documentos, nem altera a regra de consumo no momento da criação.",
        "O cliente deverá exportar e conservar seus documentos e comprovantes pelo período necessário às suas atividades e obrigações, sem prejuízo dos deveres de armazenamento e preservação expressamente assumidos pela MDTech. O encerramento da conta não será condicionado à realização prévia de download.",
      ],
    },
    {
      title: "Uso responsável",
      paragraphs: [
        "O benefício é destinado ao uso legítimo da plataforma. É vedada a criação abusiva de contas ou outros mecanismos destinados a contornar a franquia. A MDTech poderá aplicar controles antifraude proporcionais, sem discriminação indevida e conforme a legislação.",
      ],
    },
    {
      title: "Privacidade e comunicação",
      paragraphs: [
        "Os dados necessários à conta e às assinaturas são tratados conforme a Política de Privacidade MDSign. Receber ofertas e novidades é opcional quando depender de consentimento, e a escolha não altera o direito ao plano gratuito.",
      ],
    },
  ],
};

export const legalDocs: Record<LegalKind, LegalDoc> = { terms, privacy, cedro };
/** Caminho de cada página (sem o idioma). */
export const legalPaths: Record<LegalKind, string> = {
  terms: "/termos",
  privacy: "/privacidade",
  cedro: "/condicoes-cedro",
};
