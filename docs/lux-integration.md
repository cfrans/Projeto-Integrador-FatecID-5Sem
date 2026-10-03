# Integração Lux / GNOME

## Informações fornecidas pelo projeto

O Lux utiliza GNOME e o produto deve administrar seu controle parental nativo. A integração real ainda está sendo investigada e não bloqueia o desenvolvimento mobile nem a entrega acadêmica com mocks.

## Hipóteses de investigação

Um serviço no Lux poderá interagir com D-Bus, malcontent e AccountsService. Esses mecanismos são candidatos, não uma API validada nesta máquina. Tecnologia do Agent: TBD. Não houve experimento Linux nesta entrega.

## Perguntas abertas

- Qual versão/distribuição do Lux e quais pacotes/interfaces estão instalados?
- Quais restrições podem ser consultadas e alteradas, e com qual granularidade?
- Como identificar contas gerenciadas e verificar permissões?
- Quais operações exigem autorização e como respeitar os mecanismos do sistema?
- Como o Agent se autentica e alcança o backend sem depender de IP local acessível pelo celular?
- Como confirmar aplicação, indisponibilidade e revogação de pareamento?

Pedidos de liberação, expiração, fechamento automático, restrição por navegador e classificações específicas aparecem no PDF, mas não demonstram suporte do GNOME. O texto de um caminho de pareamento no Lux também é uma hipótese de UX.

## Segurança conhecida

O mobile nunca armazena senha root/admin. Dispositivos precisam ser autenticados; vínculos devem ser revogáveis. QR Code não representa uma credencial administrativa permanente. Operações Linux respeitam autorização do sistema. Credenciais sensíveis não ficam em armazenamento inseguro.

## Registro de experimentos futuros

Ao investigar, registrar ambiente/versões, procedimento, resultado observado, permissões exigidas e limitações neste documento. Separar observações de hipóteses e registrar somente capacidades demonstradas.
