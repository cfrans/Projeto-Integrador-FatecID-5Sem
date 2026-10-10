This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Backend, Lux Agent e documentação

- Backend: TypeScript/Node.js LTS, NestJS, REST, Prisma e MySQL, como monólito modular. Não introduza serviços, camadas ou dependências adicionais sem necessidade demonstrada.
- O código do backend fica em `backend/`, o agente em `lux-agent/` e a documentação do projeto em `docs/`. Preserve essa separação de responsabilidades.
- Para criar scaffolds, use os comandos oficiais compatíveis com as versões atuais: `npx @nestjs/cli new` para o backend e `npx prisma init` para a integração Prisma. Não gere manualmente estrutura que esses scaffolds fornecem.
- Antes de usar APIs NestJS, Prisma ou MySQL, consulte a documentação oficial compatível com as versões declaradas no projeto. Para mudanças Expo/React Native, mantenha obrigatórias as instruções de versão e documentação acima.
- Mantenha fronteiras claras: o mobile não acessa MySQL nem executa controles localmente; o backend é responsável pela API e persistência; o agente integra operações locais autorizadas. Trate interfaces GNOME, D-Bus, malcontent/libmalcontent, AccountsService e polkit como hipóteses até comprovação no Lenovo Lux real.
- Segurança de autenticação, autorização por recurso, identidade do computador, comunicação autenticada e pareamento por token aleatório temporário de uso único são requisitos futuros a implementar e validar. Nunca envie senha root/admin ao mobile ou exponha execução arbitrária de comandos.
- Preserve dados e comportamentos de mock documentados até existir contrato real que os substitua. Registre no diretório `docs/` decisões confirmadas, etapas, limites e hipóteses, sem apresentar planejamento como implementação.
