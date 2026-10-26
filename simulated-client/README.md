# piplup · Client simulado

Programa local Node.js para cadastrar um computador demonstrativo, mostrar o QR de pareamento e refletir as configurações recebidas do app pela API. Não altera o sistema operacional.

Com a API em desenvolvimento e a conta de teste preparadas:

```bash
npm ci
npm start
```

Abra `http://127.0.0.1:4317`, cadastre o PC e leia o QR em **Adicionar computador** no app. Mantenha o terminal aberto para sincronizar.

Consulte [Client simulado](../docs/simulated-client.md) para configurar a API, demonstrar vários computadores, entender os estados e executar testes. Credenciais locais ficam em `.state/`, ignorado pelo Git; não compartilhe essa pasta.
