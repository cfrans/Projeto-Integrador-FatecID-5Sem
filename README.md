# Lux Família

Projeto Integrador acadêmico: interface mobile para consultar e alterar remotamente o controle parental existente no GNOME dos computadores Lenovo Lux.

## Estado atual

Bootstrap com Expo SDK 57, React Native, TypeScript e Expo Router. As 12 telas placeholder e os layouts existentes foram preservados. Não há autenticação real, backend, banco ou integração Linux. Stack e abas estão declarados; os placeholders ainda não oferecem botões/links para percorrer o fluxo.

## Executar o mobile

Requer Node.js 22.13 ou superior e npm. O repositório utiliza `package-lock.json`.

```bash
cd mobile
npm ci
npm start
```

Use o QR Code do Expo em um dispositivo compatível ou as opções do terminal para emulador Android/iOS. iOS local requer macOS. Se a rede impedir a conexão, `npm run tunnel` utiliza o suporte de túnel já existente. O QR do Expo é apenas para desenvolvimento, não pareamento de um Lux.

```bash
npm run lint
npm run typecheck
npx expo install --check
npx expo-doctor
```

Para validar o empacotamento sem emulador: `npx expo export --platform android --platform ios`. O script web foi preservado, mas as dependências opcionais `react-dom` e `react-native-web` ainda não estão instaladas; o foco desta entrega é mobile.

## Organização

```text
AGENTS.md
docs/              produto, arquitetura, convenções e design
prototypes/        PDF original de referência visual
mobile/            aplicação Expo e dependências próprias
backend/README.md  responsabilidades; tecnologia TBD
lux-agent/README.md responsabilidades; tecnologia TBD
```

O caminho previsto é Mobile → Backend/API → Lux Agent → GNOME. MySQL pertence ao backend. O mobile pode desenvolver funcionalidades com mocks sem depender do Lux; o primeiro contrato e sua implementação vazia estão em `mobile/src/features/devices/services/devices.ts` e `mobile/src/mocks/devices.ts`, ainda sem conexão às telas preservadas.

Consulte [o índice da documentação](docs/README.md) para decisões, pendências e próximos passos. Referência de compatibilidade: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
