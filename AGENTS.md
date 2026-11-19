# Instruções para agentes

## Regras gerais

- Responda no idioma do usuário, de forma concisa e direta.
- Entenda o escopo antes de editar. Se houver ambiguidade, pergunte; em execução não assistida, use a interpretação mais razoável e registre-a.
- Inspecione a implementação existente e consulte a documentação relevante antes de propor mudanças. Não trate planejamento, mocks ou protótipos como funcionalidades implementadas.
- Faça alterações pequenas e direcionadas. Preserve estrutura, convenções e ferramentas; evite refatorações estéticas, abstrações e dependências sem necessidade demonstrada.
- Investigue a causa dos erros antes de corrigir. Aponte riscos e alternativas quando relevantes.
- Não faça commits sem pedido explícito e nunca se adicione como coautor.

## Código e organização

- Prefira soluções simples, legíveis e responsabilidades claras. Mantenha regras de negócio separadas da apresentação e respeite as fronteiras documentadas.
- Siga as configurações de TypeScript, lint e formatação existentes. Prefira tipos explícitos e valide dados externos nas fronteiras da aplicação.
- Trate erros e operações assíncronas de forma explícita; preserve a distinção entre falha, pendência e sucesso confirmado.
- Consulte a documentação oficial compatível com as versões declaradas antes de usar APIs ou alterar dependências. Use os comandos de instalação e geração indicados pelo projeto.
- Não adicione comentários ao código sem pedido.

## Documentação

- Comece por [docs/README.md](docs/README.md) e leia somente os documentos pertinentes à tarefa.
- Consulte [README.md](README.md) para instalação e execução; [Produto](docs/product/overview.md) para escopo; [Arquitetura](docs/architecture/overview.md) para responsabilidades, contratos e roadmap.
- Para mudanças técnicas, consulte [Mobile](docs/mobile/app.md), [Backend](docs/backend/api.md), [Banco](docs/backend/database.md) ou [Integração Linux](docs/lux/integration.md), conforme a área afetada. Para UI, leia [Design](docs/product/design.md) e a referência correspondente em `prototypes/`.
- Mantenha a documentação curta e alinhada ao código. Separe decisões confirmadas, implementação, planejamento, hipóteses e verificações pendentes; evite duplicar informações entre arquivos.

## Qualidade e segurança

- Execute lint, typecheck e testes aplicáveis pelos comandos do projeto, no diretório correspondente. Testes devem verificar comportamentos e falhas relevantes, com isolamento e resultados reproduzíveis.
- Revise o diff antes de concluir: escopo, responsabilidades, dependências sem uso, duplicação e mudanças acidentais. Em documentação, confira também links, comandos e coerência com a implementação.
- Informe o que foi realmente validado e as limitações; distinga resultados verificáveis de afirmações sem evidência.
- Nunca exponha ou versione segredos e credenciais. Respeite autenticação, autorização e privilégio mínimo.
- Avise antes de ações destrutivas ou de risco relevante. Não faça commits sem pedido explícito nem adicione coautoria; quando autorizado, siga Conventional Commits.
