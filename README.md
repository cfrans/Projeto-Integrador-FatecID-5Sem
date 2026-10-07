# piplup

Projeto Integrador acadêmico: interface mobile para consultar e alterar remotamente o controle parental existente no GNOME dos computadores Lenovo Lux.

## Estado atual

Bootstrap com Expo SDK 57, React Native, TypeScript e Expo Router. As 12 telas placeholder e os layouts existentes foram preservados. Não há autenticação real, backend, banco ou integração Linux. Stack e abas estão declarados; os placeholders ainda não oferecem botões/links para percorrer o fluxo.

## Executar o mobile

Requer Node.js 22.13 ou superior e npm. O repositório utiliza `package-lock.json`.

```bash
cd mobile
npm install
npx expo start
```

Use o QR Code do Expo Go em um dispositivo compatível ou as opções do terminal para emulador Android/iOS. iOS local requer macOS. Se a rede impedir a conexão, inicie com `npx expo start --tunnel`. O QR do Expo é apenas para desenvolvimento, não pareamento de um Lux. O app ainda não usa `expo-dev-client`.

```bash
npm run lint
npm run typecheck
npx expo install --check
npx expo-doctor
```

Para validar o empacotamento sem emulador: `npx expo export --platform android --platform ios`. O script web foi preservado, mas as dependências opcionais `react-dom` e `react-native-web` ainda não estão instaladas; o foco desta entrega é mobile.

## Builds com EAS

Os identificadores nativos em `mobile/app.json` são `br.edu.fatecid.piplup` para Android e iOS. Para vincular o projeto ao EAS e gerar a configuração inicial, use o CLI:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Os perfis em `mobile/eas.json` permitem builds remotos após essa configuração. O perfil `development` gera APK Android debug para distribuição interna; ele não inclui `expo-dev-client`, então o fluxo de desenvolvimento em dispositivo permanece no Expo Go. Um cliente nativo de desenvolvimento poderá ser configurado quando houver necessidade. Este perfil não estabelece um fluxo debug funcional para iOS.

```bash
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile production
```

`preview` gera APK Android interno para instalação direta. `production` gera Android App Bundle (AAB), formato destinado à publicação na Play Store. Build de produção iOS requer credenciais Apple. Esses comandos são instruções para uso futuro; nenhum build remoto foi iniciado nesta configuração.

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
