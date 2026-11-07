# Design

## Fonte e limites

Referências autorizadas: [Controle Parental Lux.pdf](../prototypes/Controle%20Parental%20Lux.pdf), 11 páginas, e o protótipo HTML agrupado em [`prototypes/Controle Parental Lux.html`](../prototypes/Controle%20Parental%20Lux.html). O HTML foi decodificado do bundle para conferir textos e hierarquia das telas; seu CSS e as interações simuladas não são código de produção nem definem medidas React Native. As telas preservam os tokens existentes.

## Variantes e convenção inicial

| Páginas | Referência |
| --- | --- |
| 1–2 | Pedido de liberação e variações claro/vermelho |
| 3–4 | Tema claro; acento roxo e variante vermelha |
| 5–6 | Tema escuro com acento vermelho |
| 7–11 | Fluxo e quadro de telas com acento roxo; estados e versão Android |

O app implementa temas **Sistema**, **Claro** e **Escuro**, com acento vermelho nas duas paletas. Sistema acompanha a aparência do dispositivo. As telas compartilham tokens por paleta; a imagem da câmera e seus overlays permanecem escuros nos dois temas. As variantes roxas do protótipo são referências, não tokens implementados.

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

A fonte executável permanece em `mobile/src/theme/colors.ts` e `spacing.ts`. A tabela registra os valores da paleta escura; `lightColors` contém os valores da variante clara. Valores abaixo são do código existente, não medidas inferidas do PDF:

| Semântica | Token escuro | Valor |
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

Na página 5, preenchimentos vetoriais incluem `#161826` (fundo dos aparelhos), `#232532` (superfícies), `#E1483A` (acento) e `#E9E9ED` (texto claro). São referências extraídas do PDF, não equivalentes exatos dos tokens existentes. O login preserva a paleta escura e vermelha já definida no app.

Escala existente de espaçamento: `xs=4`, `sm=8`, `md=12`, `lg=16`, `xl=24`, `xxl=32`. Radius: `sm=8`, `md=12`, `lg=16`, `pill=999`. O PDF evidencia espaçamento/raios recorrentes, mas não confirma esses números em unidades React Native.

Escala tipográfica local usada no login, em unidades React Native:

| Chave | Valor | Uso |
| --- | --- | --- |
| `brand` | 20 | Nome piplup |
| `title` | 29 | Título da tela |
| `body` | 14 | Texto de apoio |
| `label` | 12 | Rótulos e mensagens auxiliares |
| `input` | 16 | Campos de entrada |
| `button` | 15 | Ação principal |

Esses valores adaptam a hierarquia do protótipo para React Native; não são conversões exatas das medidas CSS. A fonte nativa permanece em uso. Os recursos do PDF incluem fontes Type3 sem identificação suficiente para escolher outra família.

## Login piplup

O login usa a hierarquia observada no HTML: marca no topo, “Bem-vindo de volta”, texto de apoio, campos de e-mail e senha, ação principal e ação secundária. A ação principal “Entrar” usa a variante `solid` do Button: fundo vermelho preenchido (`colors.accent`), texto `colors.textPrimary`, centralizada e com largura mínima de 220, em vez de ocupar toda a linha. É uma exceção intencional à convenção de botões contornados, restrita ao login; os demais botões seguem a variante `outline`. A marca passa a ser `piplup`; fundo e textos usam a paleta ativa, mantendo o acento vermelho. A tipografia permanece nativa. O feedback de validação local substitui as mensagens de autenticação do protótipo, que não representam um contrato real.

No login, cadastro e recuperação de senha mantêm a ordem original, com alvos de toque de pelo menos 44 e margens verticais de 16 e 12, respectivamente. No cadastro, a confirmação informa se as senhas coincidem enquanto o usuário digita em qualquer um dos dois campos; confirmação vazia permanece neutra antes do envio. Texto e borda distinguem divergência de coincidência, com verde para a coincidência. Isso não substitui a validação de tamanho mínimo da senha.

## Home, computadores e pareamento

Na Home, o cartão **Adicionar computador** aparece após carregar a lista somente quando não há PC pareado. Com pelo menos um vínculo ativo, um botão **+** no cabeçalho de **Computadores**, ao lado de **Ver todos**, abre a leitura do QR. O botão mantém rótulo acessível e área de toque mínima de 44.

Na Home, Sair é um botão compacto com ícone à esquerda, contorno e fundo no canto superior, com alvo de toque mínimo de 44, sem ocupar uma linha inteira. A Home e a lista mantêm cards compactos com nome, conta gerenciada e status acompanhado de texto. As ações contornadas abrem a lista ou o pareamento. Carregamento, erro com nova tentativa e lista vazia usam a mesma paleta. A lista utiliza `FlatList`; o conteúdo da Home pode rolar.

O pareamento preserva a moldura de leitura e a confirmação do HTML numa única rota. A leitura usa `expo-camera`; confirmação do computador e remoção de vínculo reutilizam os componentes existentes. Dados demonstrativos continuam identificados como demonstração. O Button mantém estado desativado visual e acessível durante solicitações pendentes; nenhuma mudança de paleta ou estrutura de navegação foi necessária.

## React Native Reusables

Foram consultados [instalação](https://reactnativereusables.com/docs/installation), [Text](https://reactnativereusables.com/docs/components/text), [Button](https://reactnativereusables.com/docs/components/button) e [Card](https://reactnativereusables.com/docs/components/card).

O login usa wrappers locais `Button` e `Input`, adaptados dos componentes [Button](https://github.com/founded-labs/react-native-reusables/blob/main/packages/registry/src/nativewind/components/ui/button.tsx) e [Input](https://github.com/founded-labs/react-native-reusables/blob/main/packages/registry/src/nativewind/components/ui/input.tsx) do React Native Reusables. O Button tem a variante `outline` (padrão, contornada) e a `solid` (preenchida), e recebe um `label`; o Input preserva as props, callbacks, estilo e ref de `TextInput`, com estado inválido baseado nos tokens do app. As adaptações usam `Pressable`, `TextInput` e `StyleSheet`; não instalaram NativeWind/Uniwind nem adicionaram dependências. Nenhum contexto genérico de Text foi criado.

A Home usa `Card`, adaptado do [Card do React Native Reusables](https://github.com/founded-labs/react-native-reusables/blob/main/packages/registry/src/nativewind/components/ui/card.tsx) com `View`, `StyleSheet` e os tokens existentes, sem novas dependências. O `DeviceCard` pertence à feature de dispositivos e apresenta nome, conta gerenciada, status textual e última conexão; sua composição pode ser reutilizada na lista. `Dialog` não foi adicionado; a confirmação de revogação usa `Alert` nativo no Android/iOS, sem um novo componente genérico. Customizações preservam contorno, paleta, hierarquia e estados observados.

## Estados, acessibilidade e pendências

O PDF mostra erro, sucesso, sincronização em andamento, falha de comunicação e seleção. As telas implementadas usam rótulos acessíveis, alvos de toque de pelo menos 44, estado desativado e foco no primeiro campo inválido do login. Status combina texto e cor. Contraste, fonte ampliada e leitores de tela ainda precisam de validação em dispositivo.

Mensagens do PDF sobre chaves guardadas apenas no celular, fila offline, prazos e fechamento automático não são decisões de segurança ou garantias técnicas. Revisar o texto após definir contratos e validar a integração. Ações normais e destrutivas compartilham a cor vermelha no código atual; quando existirem, diferenciá-las por texto/contexto e confirmação apropriada.

TODO: validar contraste, fonte ampliada e leitores de tela em dispositivo. Não inferir especificações de produção apenas das medidas de impressão.

## Restrições: contexto compartilhado

O retorno fica somente no cabeçalho nativo. O computador e a conta aparecem uma vez, em um cartão compacto; com múltiplos vínculos, **Trocar** abre uma lista modal e preserva a aba atual. O status de aplicação simulada fica abaixo do seletor, com texto e indicador discreto. Cada aba exibe seu título, sem repetir nome/conta ou badge de simulação. A barra inferior respeita o inset do sistema.

Navegadores usam [logos locais das fontes oficiais](../mobile/assets/browsers/README.md), preservando proporção e cores, sem downloads em tempo de execução ou dependência gráfica adicional.

## Identidade de aplicativos e computadores

`ApplicationIcon` compartilha logos locais entre navegadores, inventário e pedidos de instalação; nomes conhecidos e IDs Linux têm aliases explícitos, e desconhecidos mantêm a inicial. [Fontes dos aplicativos](../mobile/assets/applications/README.md).

Computadores usam monitor por padrão, com opções Notebook, PC gamer e Servidor. Toque no ícone com o indicador de edição no cartão da Home ou da lista para personalizar; o seletor das restrições usa a mesma escolha. A preferência é local, separada por responsável e UUID do computador; não altera hardware, presença ou dados no backend. [Assets e licença](../mobile/assets/computers/README.md).

## Melhorias de usabilidade no mobile

Aplicativos oferece limpeza de busca, nova tentativa de carregamento e confirmação de restrição em lote em modal local com paleta ativa, fundo escurecido e ações de cancelar/confirmar, explicitando computador e alcance sobre toda a lista, inclusive fora do filtro. A busca cresce com a fonte do sistema; ações têm área mínima de 44 e a chave visual não duplica o anúncio da linha pelo leitor de tela.

Computadores permite puxar para atualizar. Falhas transitórias preservam a última lista com aviso de dados possivelmente desatualizados; erros de autorização ou resposta inválida retiram a lista. Nova consulta bem-sucedida remove o aviso. Os cartões acomodam status em outra linha em telas estreitas ou com fonte ampliada e usam texto secundário para demonstração/último contato. Rótulos dos botões compartilhados podem quebrar linha com alinhamento central.

Contraste, fonte ampliada, gesto de atualização e navegação com TalkBack/VoiceOver ainda exigem conferência em aparelho; estas mudanças não certificam acessibilidade de todo o app.

O botão de login exibe indicador circular junto de “Entrando…” durante a autenticação. O carregamento mantém o botão bloqueado e sinaliza estado ocupado para tecnologias assistivas, sem atraso artificial.
