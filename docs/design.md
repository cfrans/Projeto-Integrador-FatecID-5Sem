# Design

## Fonte e limites

Referência autorizada: [Controle Parental Lux.pdf](../prototypes/Controle%20Parental%20Lux.pdf), 11 páginas. HTML originais não estão disponíveis. O PDF permite observar hierarquia, cores e componentes, mas não recuperar com segurança medidas CSS, família tipográfica completa ou interações. As telas e tokens existentes foram preservados nesta entrega.

## Variantes e convenção inicial

| Páginas | Referência |
| --- | --- |
| 1–2 | Pedido de liberação e variações claro/vermelho |
| 3–4 | Tema claro; acento roxo e variante vermelha |
| 5–6 | Tema escuro com acento vermelho |
| 7–11 | Fluxo e quadro de telas com acento roxo; estados e versão Android |

O app existente já usa tema escuro e acento vermelho. Manter essa convenção como referência inicial, alinhada às páginas 5–6, enquanto o grupo define o tema final. Não misturar variantes em componentes isolados nem implementar seletor de temas nesta etapa.

## Padrões observados

- Fundo escuro neutro, superfícies ligeiramente mais claras e bordas discretas. Na variante clara, fundo suave e superfícies quase brancas.
- Acento localizado em ícones, texto, contorno e seleção; botões principais contornados, sem grandes áreas vermelhas.
- Hierarquia por título, texto de apoio e rótulos de seção pequenos em maiúsculas. Texto sem serifa; pesos diferentes distinguem títulos e conteúdo.
- Cards/listas compactos: ícone à esquerda, nome e descrição empilhados, ação/status à direita. Atalhos organizados em duas colunas.
- Cantos arredondados; badges de status em formato de cápsula. Espaçamento consistente entre seções e menor dentro de linhas relacionadas.
- Ícones Phosphor identificados nos recursos do PDF, majoritariamente contornados, com variantes preenchidas. Nenhuma dependência de ícones adicionada; adoção mobile pendente.
- Formulários com rótulo acima do campo, senha oculta, ação principal e ação secundária textual. Erro próximo ao formulário.
- Estados de sincronização em badges e feedback próximo à base da tela; confirmação de remoção em diálogo. Switches para bloqueio e lista de seleção para idade.
- Navegação com cabeçalho contextual, retorno e quatro abas de restrições. O protótipo também sugere menu lateral; o app atual preserva Stack e Tabs, sem implementar drawer.

## Tokens existentes e diferenças

A fonte executável permanece em `mobile/src/theme/colors.ts` e `spacing.ts`. Valores abaixo são do código existente, não medidas inferidas do PDF:

| Semântica | Token atual | Valor |
| --- | --- | --- |
| Fundo | `colors.background` | `#0F1118` |
| Superfície | `colors.surface` | `#1A1C25` |
| Superfície elevada | `colors.surfaceRaised` | `#232631` |
| Borda | `colors.border` | `#2E313D` |
| Texto principal | `colors.textPrimary` | `#ECEDF2` |
| Texto secundário | `colors.textSecondary` | `#9A9DAB` |
| Texto discreto | `colors.textMuted` | `#6B6E7C` |
| Acento | `colors.accent` | `#E5483D` |
| Fundo de acento | `colors.accentSoft` | `#3A1814` |
| Texto de acento | `colors.accentText` | `#FF8A80` |
| Sucesso | `colors.success` | `#4CAF7A` |
| Perigo | `colors.danger` | `#E5483D` |

Na página 5, preenchimentos vetoriais incluem `#161826` (fundo dos aparelhos), `#232532` (superfícies), `#E1483A` (acento) e `#E9E9ED` (texto claro). São referências extraídas do PDF, não equivalentes exatos dos tokens existentes. Validar com os HTML antes de substituir a paleta; nenhuma alteração visual nesta entrega.

Escala existente de espaçamento: `xs=4`, `sm=8`, `md=12`, `lg=16`, `xl=24`, `xxl=32`. Radius: `sm=8`, `md=12`, `lg=16`, `pill=999`. O PDF evidencia espaçamento/raios recorrentes, mas não confirma esses números em unidades React Native.

O placeholder usa título de 20 com peso 600. Ainda não há escala tipográfica normalizada; preservar fonte nativa até identificar a família/medidas originais. Recursos do PDF incluem fontes Type3 sem identificação suficiente. Não adicionar fontes por suposição.

## React Native Reusables

Foram consultados [instalação](https://reactnativereusables.com/docs/installation), [Text](https://reactnativereusables.com/docs/components/text), [Button](https://reactnativereusables.com/docs/components/button) e [Card](https://reactnativereusables.com/docs/components/card).

Componentes adotados inicialmente: nenhum. As telas preservadas usam apenas o `Screen` existente com `View` e `Text` nativos. Não há Button, Input, Card ou Dialog necessários nesta estrutura. A instalação e o sistema de estilos/contexto do Text não trazem benefício atual que justifique substituir o texto nativo existente.

Ao implementar a primeira tela, avaliar Button/Input para formulário, Card para superfícies reutilizadas e Dialog para confirmação. São candidatos, não componentes instalados. Definir a integração de estilos apenas nessa ocasião e adicionar somente o que a tela consumir. Customizações devem preservar contorno, paleta, hierarquia e estados observados.

## Estados, acessibilidade e pendências

O PDF mostra erro, sucesso, sincronização em andamento, falha de comunicação e seleção. Disabled, foco por teclado e leitores de tela não estão especificados. Antes de implementar, definir contraste, rótulos acessíveis, alvos de toque e comportamento com fonte ampliada. Status deve combinar texto e cor; testes de acessibilidade ainda não foram realizados.

Mensagens do PDF sobre chaves guardadas apenas no celular, fila offline, prazos e fechamento automático não são decisões de segurança ou garantias técnicas. Revisar o texto após definir contratos e validar a integração. Ações normais e destrutivas compartilham a cor vermelha no código atual; quando existirem, diferenciá-las por texto/contexto e confirmação apropriada.

TODO: obter HTML, confirmar tema com o grupo, medir tipografia/espaçamento, validar contraste e registrar componentes efetivamente adotados. Não inventar um design system completo a partir de medidas de impressão.
