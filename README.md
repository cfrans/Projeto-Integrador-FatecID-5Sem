# piplup

Projeto Integrador acadêmico: interface mobile para consultar e alterar remotamente o controle parental existente no GNOME dos computadores Lenovo Lux.

## Estado atual

O piplup usa Expo SDK 57, React Native, TypeScript e Expo Router. Quatro telas demonstrativas compõem o fluxo atual: login, início, computadores e pareamento simulado. No login, qualquer e-mail com formato válido e senha não vazia segue para início; use dados fictícios, pois não há autenticação e as credenciais não são verificadas nem enviadas.

Em `/home`, a lista vem de um mock com três computadores de exemplo. `/computers` mostra a lista e também permite abrir `/qr-scan`. Essa tela não ativa a câmera nem lê QR Code: o botão adiciona um quarto computador fictício, de forma idempotente e somente em memória até o processo do app reiniciar. A confirmação aparece na própria tela e leva a `/computers`; ao voltar para `/home`, a lista é atualizada. As outras oito rotas e os layouts existentes permanecem como placeholders, fora do fluxo implementado.

Não há autenticação real, API/backend conectado ao mobile nem integração Linux. A fundação backend utiliza NestJS, Prisma e MySQL em Docker, com saúde e OpenAPI; o app permanece com mocks e não acessa o banco.

## Executar o mobile

Requer Node.js 22.13 ou superior e npm. O repositório utiliza `package-lock.json`.

```bash
cd mobile
npm install
npx expo start
```

Use o QR Code do Expo Go em um dispositivo compatível ou as opções do terminal para emulador Android/iOS. iOS local requer macOS. Se a rede impedir a conexão, inicie com `npx expo start --tunnel`. O QR do Expo é apenas para desenvolvimento, não pareamento de um Lux. O app ainda não usa `expo-dev-client`.

Em CI, use `npm ci` para instalar a partir do `package-lock.json`.

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

Os perfis em `mobile/eas.json` permitem builds remotos após essa configuração. O perfil `development` gera APK Android debug para distribuição interna; ele não inclui `expo-dev-client`, então o fluxo de desenvolvimento em dispositivo permanece no Expo Go. Um cliente nativo de desenvolvimento poderá ser configurado quando houver necessidade, seguindo a [documentação de development builds](https://docs.expo.dev/develop/development-builds/introduction/). Este perfil não estabelece um fluxo debug funcional para iOS.

```bash
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile production
```

`preview` gera APK Android interno para instalação direta. `production` gera Android App Bundle (AAB), formato destinado à publicação na Play Store. Build de produção iOS requer credenciais Apple. Esses comandos são instruções para uso futuro; nenhum build remoto foi iniciado nesta configuração.

Referências: [configuração do EAS](https://docs.expo.dev/build/eas-json/) e [builds APK para Android](https://docs.expo.dev/build-reference/apk/).

## Backend e MySQL locais

O mobile não usa esse banco. Para preparar a infraestrutura, siga [Backend](docs/backend.md) e [Banco de dados](docs/database.md). Na raiz, copie o arquivo de exemplo e preencha `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` com senhas locais distintas em `.env`:

```bash
cp .env.example .env
```

Depois, inicie e confira o serviço:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Backend: `http://localhost:3000`, saúde: `/health`, Swagger: `/docs` e OpenAPI: `/docs-json`. As portas são locais; HTTPS deverá ser configurado no ambiente de hospedagem futuro. Para parar os serviços, execute `docker compose down`; os dados do volume são preservados.

## Organização

```text
AGENTS.md
docs/              produto, arquitetura, convenções e design
prototypes/        PDF e HTML agrupado, referências visuais
mobile/            aplicação Expo e dependências próprias
backend/           NestJS, Prisma, testes e Dockerfile
lux-agent/README.md planejamento Python 3/systemd; sem implementação
```

O mobile se comunicará com a API por REST/HTTPS. O Lux Agent iniciará polling REST/HTTPS ao backend e integrará localmente o GNOME. MySQL pertence ao backend. Hoje, Home e computadores leem o mock em `mobile/src/mocks/devices.ts` via o contrato interno de listagem. O login e o pareamento não usam API: a demonstração de pareamento é uma operação local separada do contrato de listagem.

Consulte [o índice da documentação](docs/README.md) para decisões, pendências e próximos passos. Referência de compatibilidade: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
