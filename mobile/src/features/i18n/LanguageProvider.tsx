import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';

type TranslationKey = string;

export type Language = 'pt-BR' | 'en' | 'es';

const LANGUAGE_STORAGE_KEY = 'piplup-language-preference-v2';

const translations: Record<Language, Record<TranslationKey, string>> = {
  'pt-BR': {
    'nav.computers': 'Computadores',
    'nav.pairComputer': 'Parear computador',
    'nav.about': 'Sobre o projeto',
    'nav.restrictions': 'Restrições',
    'nav.accessRequest': 'Pedido de liberação',
    'nav.sync': 'Sincronização',
    'nav.browsers': 'Navegadores',
    'nav.apps': 'Aplicativos',
    'nav.install': 'Instalação',
    'nav.age': 'Idade',
    'language.title': 'Idioma',
    'language.portuguese': 'Português',
    'language.english': 'Inglês',
    'language.spanish': 'Espanhol',
    'about.eyebrow': 'GRUPO 2 · FATEC INDAIATUBA',
    'about.title': 'Projeto Integrador · 5º trimestre',
    'about.description': 'Sistema mobile de controle parental para o Lux, com pareamento por QR Code e comunicação via Web Service.',
    'about.github': 'Ver projeto no GitHub',
    'about.courses': 'DISCIPLINAS INTEGRADAS',
    'about.footer': 'Fatec Indaiatuba Dr. Archimedes Lammoglia · 2026 · versão 0.9.0 (camada simulada)',
    'home.eyebrow': 'PIPLUP · CONTROLE FAMILIAR', 'home.greeting': 'Olá, {name}', 'home.subtitle': 'Acompanhe os computadores da sua família.',
    'common.signOut': 'Sair', 'common.signingOut': 'Saindo…', 'common.addComputer': 'Adicionar computador',
    'home.addDescription': 'Leia o QR Code exibido no Lux para associar um novo computador.', 'common.computers': 'Computadores',
    'common.viewAll': 'Ver todos', 'common.loadingComputers': 'Carregando computadores…', 'common.loadError': 'Não foi possível carregar',
    'common.retry': 'Tentar novamente', 'home.noneTitle': 'Nenhum computador associado', 'home.noneDescription': 'Leia o QR Code temporário exibido no computador para criar um vínculo.',
    'home.shortcuts': 'ATALHOS DE RESTRIÇÃO', 'home.browsers': 'Navegadores', 'home.blocked': 'Bloqueados', 'home.apps': 'Aplicativos',
    'home.installed': 'Ver instalados', 'home.installation': 'Instalação', 'home.age': 'Faixa etária', 'home.upTo12': 'Até 12 anos',
    'auth.tagline': 'Parental Insight Platform for Lux User Protection', 'auth.welcome': 'Bem-vindo de volta',
    'auth.loginDescription': 'Entre com sua conta de responsável para gerenciar os computadores da família.', 'common.email': 'E-mail',
    'common.password': 'Senha', 'auth.emailPlaceholder': 'responsavel@email.com', 'auth.passwordPlaceholder': 'Digite sua senha',
    'auth.validEmail': 'Informe um e-mail válido.', 'auth.requiredPassword': 'Informe sua senha.', 'common.show': 'Mostrar', 'common.hide': 'Ocultar',
    'auth.signingIn': 'Entrando…', 'auth.signIn': 'Entrar', 'auth.retryConnection': 'Tentar conexão novamente',
    'auth.registerPrompt': 'Não tem conta? Cadastre-se', 'auth.forgot': 'Esqueci minha senha', 'auth.forgotUnavailable': 'Recuperação de senha indisponível no momento.',
    'auth.createAccount': 'Criar conta', 'auth.registerDescription': 'Cadastre-se como responsável para gerenciar os computadores da família.', 'common.name': 'Nome',
    'auth.namePlaceholder': 'Seu nome', 'auth.createPassword': 'Crie uma senha', 'auth.confirmPassword': 'Confirmar senha',
    'auth.confirmPlaceholder': 'Repita a senha', 'auth.passwordMin': 'A senha deve ter ao menos {count} caracteres.', 'auth.passwordMismatch': 'As senhas não coincidem.',
    'auth.completed': 'Cadastro concluído', 'auth.completedDescription': 'Conta simulada: nenhum dado foi salvo ou enviado, pois ainda não há backend. Volte ao login para continuar.',
    'auth.goLogin': 'Ir para o login', 'auth.haveAccount': 'Já tenho conta',
    'restriction.sync': 'Sincronizado', 'restriction.syncing': 'Sincronizando', 'restriction.loadingComputer': 'Carregando computador…', 'restriction.noComputer': 'Nenhum computador conectado', 'restriction.pairToContinue': 'Faça o pareamento de um computador para continuar.',
    'restriction.blockBrowsers': 'Bloquear navegadores', 'restriction.blockBrowsersDescription': 'Impede a abertura de qualquer navegador na conta da criança.', 'restriction.allowedExceptions': 'EXCEÇÕES PERMITIDAS', 'restriction.browserFooter': 'Com o bloqueio geral ativo, apenas os navegadores marcados continuam disponíveis.',
    'restriction.searchApp': 'Buscar aplicativo', 'restriction.allowedApps': '{allowed} de {total} aplicativos liberados', 'restriction.restrictAll': 'Restringir todos', 'restriction.noAppMatch': 'Nenhum aplicativo corresponde à busca.', 'restriction.appsUnavailable': 'Aplicativos indisponíveis', 'restriction.installUnavailable': 'Pedidos indisponíveis',
    'restriction.blockInstall': 'Bloquear instalação', 'restriction.blockInstallDescription': 'Novos aplicativos só podem ser instalados com sua aprovação.', 'restriction.pendingRequests': 'PEDIDOS AGUARDANDO VOCÊ', 'restriction.noPendingRequests': 'Nenhum pedido pendente', 'restriction.newRequests': 'Novos pedidos enviados pelo computador aparecerão aqui.', 'restriction.allow': 'Permitir', 'restriction.deny': 'Recusar', 'restriction.requestBy': 'Pedido por {name} · {time}',
    'restriction.ageAdjustment': 'Adequação etária', 'restriction.account': 'conta {name}', 'restriction.loadingAccountComputers': 'Carregando computadores da conta…', 'restriction.computer': 'COMPUTADOR', 'restriction.free': 'Livre', 'restriction.noAgeRestriction': 'Sem restrição de idade', 'restriction.age10': '10 anos', 'restriction.age12': '12 anos', 'restriction.age16': '16 anos', 'restriction.age18': '18 anos', 'restriction.contentLight': 'Conteúdo leve, sem violência', 'restriction.violenceLight': 'Violência leve, linguagem branda', 'restriction.moderateAdult': 'Conteúdo adulto moderado', 'restriction.noRatingFilter': 'Sem filtro de classificação',
    'pairing.eyebrow': 'PAREAMENTO SEGURO', 'pairing.title': 'Adicionar computador', 'pairing.description': 'Leia o QR Code temporário exibido no computador. Confira os dados antes de criar o vínculo.', 'pairing.demoCreated': 'Vínculo de demonstração criado', 'pairing.computerAssociated': 'Computador associado', 'pairing.demoNote': 'Este computador é uma simulação. A integração real com o Lux ainda não foi validada.', 'pairing.activeNote': 'O vínculo está ativo. A conexão com o Lux ainda não foi validada.', 'pairing.viewComputers': 'Ver computadores', 'pairing.confirm': 'Confirme este computador', 'pairing.managedAccount': 'Conta gerenciada: {name}', 'pairing.demoConfirm': 'Demonstração: confirmar cria somente um vínculo de demonstração; não comprova integração com o Lux.', 'pairing.qrValid': 'QR válido até {time}', 'pairing.creating': 'Criando vínculo…', 'pairing.confirmLink': 'Confirmar vínculo', 'common.cancel': 'Cancelar', 'pairing.validating': 'Validando QR Code…', 'pairing.readAnother': 'Ler outro QR Code', 'pairing.cameraNeeded': 'A câmera é necessária', 'pairing.cameraDescription': 'O acesso é usado para ler QR Codes de pareamento.', 'pairing.requestAccess': 'Solicitando acesso…', 'pairing.enableCamera': 'Ativar câmera', 'pairing.openSettings': 'Abrir configurações', 'pairing.qrNote': 'QR temporário de uso único. Não compartilhe o código; ele não é salvo no aparelho.',
  },
  en: {
    'nav.computers': 'Computers',
    'nav.pairComputer': 'Pair computer',
    'nav.about': 'About the project',
    'nav.restrictions': 'Restrictions',
    'nav.accessRequest': 'Access request',
    'nav.sync': 'Synchronization',
    'nav.browsers': 'Browsers',
    'nav.apps': 'Apps',
    'nav.install': 'Installation',
    'nav.age': 'Age',
    'language.title': 'Language',
    'language.portuguese': 'Portuguese',
    'language.english': 'English',
    'language.spanish': 'Spanish',
    'about.eyebrow': 'GROUP 2 · FATEC INDAIATUBA',
    'about.title': 'Integrative Project · 5th term',
    'about.description': 'Mobile parental control system for Lux, with QR Code pairing and Web Service communication.',
    'about.github': 'View project on GitHub',
    'about.courses': 'INTEGRATED COURSES',
    'about.footer': 'Fatec Indaiatuba Dr. Archimedes Lammoglia · 2026 · version 0.9.0 (simulated layer)',
    'home.eyebrow': 'PIPLUP · FAMILY CONTROL', 'home.greeting': 'Hello, {name}', 'home.subtitle': 'Keep track of your family computers.',
    'common.signOut': 'Sign out', 'common.signingOut': 'Signing out…', 'common.addComputer': 'Add computer',
    'home.addDescription': 'Scan the QR Code shown on Lux to pair a new computer.', 'common.computers': 'Computers', 'common.viewAll': 'View all',
    'common.loadingComputers': 'Loading computers…', 'common.loadError': 'Could not load', 'common.retry': 'Try again',
    'home.noneTitle': 'No computer associated', 'home.noneDescription': 'Scan the temporary QR Code shown on the computer to create a link.',
    'home.shortcuts': 'RESTRICTION SHORTCUTS', 'home.browsers': 'Browsers', 'home.blocked': 'Blocked', 'home.apps': 'Apps', 'home.installed': 'View installed',
    'home.installation': 'Installation', 'home.age': 'Age rating', 'home.upTo12': 'Up to 12 years', 'auth.tagline': 'Parental Insight Platform for Lux User Protection',
    'auth.welcome': 'Welcome back', 'auth.loginDescription': 'Sign in with your guardian account to manage your family computers.', 'common.email': 'Email',
    'common.password': 'Password', 'auth.emailPlaceholder': 'guardian@email.com', 'auth.passwordPlaceholder': 'Enter your password', 'auth.validEmail': 'Enter a valid email.',
    'auth.requiredPassword': 'Enter your password.', 'common.show': 'Show', 'common.hide': 'Hide', 'auth.signingIn': 'Signing in…', 'auth.signIn': 'Sign in',
    'auth.retryConnection': 'Try connection again', 'auth.registerPrompt': 'No account? Sign up', 'auth.forgot': 'Forgot my password', 'auth.forgotUnavailable': 'Password recovery is unavailable right now.',
    'auth.createAccount': 'Create account', 'auth.registerDescription': 'Sign up as a guardian to manage your family computers.', 'common.name': 'Name', 'auth.namePlaceholder': 'Your name',
    'auth.createPassword': 'Create a password', 'auth.confirmPassword': 'Confirm password', 'auth.confirmPlaceholder': 'Repeat your password', 'auth.passwordMin': 'Password must have at least {count} characters.',
    'auth.passwordMismatch': 'Passwords do not match.', 'auth.completed': 'Registration complete', 'auth.completedDescription': 'Demo account: no data was saved or sent because there is no backend yet. Return to login to continue.',
    'auth.goLogin': 'Go to login', 'auth.haveAccount': 'I already have an account',
    'restriction.sync': 'Synced', 'restriction.syncing': 'Syncing', 'restriction.loadingComputer': 'Loading computer…', 'restriction.noComputer': 'No computer connected', 'restriction.pairToContinue': 'Pair a computer to continue.', 'restriction.blockBrowsers': 'Block browsers', 'restriction.blockBrowsersDescription': 'Prevents any browser from opening on the child account.', 'restriction.allowedExceptions': 'ALLOWED EXCEPTIONS', 'restriction.browserFooter': 'When general blocking is active, only marked browsers remain available.', 'restriction.searchApp': 'Search app', 'restriction.allowedApps': '{allowed} of {total} apps allowed', 'restriction.restrictAll': 'Restrict all', 'restriction.noAppMatch': 'No app matches the search.', 'restriction.appsUnavailable': 'Apps unavailable', 'restriction.installUnavailable': 'Requests unavailable', 'restriction.blockInstall': 'Block installation', 'restriction.blockInstallDescription': 'New apps can only be installed with your approval.', 'restriction.pendingRequests': 'REQUESTS WAITING FOR YOU', 'restriction.noPendingRequests': 'No pending requests', 'restriction.newRequests': 'New requests sent by the computer will appear here.', 'restriction.allow': 'Allow', 'restriction.deny': 'Deny', 'restriction.requestBy': 'Requested by {name} · {time}', 'restriction.ageAdjustment': 'Age suitability', 'restriction.account': 'account {name}', 'restriction.loadingAccountComputers': 'Loading account computers…', 'restriction.computer': 'COMPUTER', 'restriction.free': 'Everyone', 'restriction.noAgeRestriction': 'No age restriction', 'restriction.age10': '10 years', 'restriction.age12': '12 years', 'restriction.age16': '16 years', 'restriction.age18': '18 years', 'restriction.contentLight': 'Light content, no violence', 'restriction.violenceLight': 'Mild violence, mild language', 'restriction.moderateAdult': 'Moderate adult content', 'restriction.noRatingFilter': 'No rating filter',
    'pairing.eyebrow': 'SECURE PAIRING', 'pairing.title': 'Add computer', 'pairing.description': 'Scan the temporary QR Code shown on the computer. Check the details before creating the link.', 'pairing.demoCreated': 'Demo link created', 'pairing.computerAssociated': 'Computer associated', 'pairing.demoNote': 'This computer is a simulation. Real integration with Lux has not been validated yet.', 'pairing.activeNote': 'The link is active. Connection to Lux has not been validated yet.', 'pairing.viewComputers': 'View computers', 'pairing.confirm': 'Confirm this computer', 'pairing.managedAccount': 'Managed account: {name}', 'pairing.demoConfirm': 'Demo: confirming creates only a demo link; it does not prove Lux integration.', 'pairing.qrValid': 'QR valid until {time}', 'pairing.creating': 'Creating link…', 'pairing.confirmLink': 'Confirm link', 'common.cancel': 'Cancel', 'pairing.validating': 'Validating QR Code…', 'pairing.readAnother': 'Scan another QR Code', 'pairing.cameraNeeded': 'Camera required', 'pairing.cameraDescription': 'Access is used to scan pairing QR Codes.', 'pairing.requestAccess': 'Requesting access…', 'pairing.enableCamera': 'Enable camera', 'pairing.openSettings': 'Open settings', 'pairing.qrNote': 'One-time QR Code. Do not share it; it is not saved on the device.',
  },
  es: {
    'nav.computers': 'Computadoras',
    'nav.pairComputer': 'Vincular computadora',
    'nav.about': 'Sobre el proyecto',
    'nav.restrictions': 'Restricciones',
    'nav.accessRequest': 'Solicitud de acceso',
    'nav.sync': 'Sincronización',
    'nav.browsers': 'Navegadores',
    'nav.apps': 'Aplicaciones',
    'nav.install': 'Instalación',
    'nav.age': 'Edad',
    'language.title': 'Idioma',
    'language.portuguese': 'Portugués',
    'language.english': 'Inglés',
    'language.spanish': 'Español',
    'about.eyebrow': 'GRUPO 2 · FATEC INDAIATUBA',
    'about.title': 'Proyecto Integrador · 5º trimestre',
    'about.description': 'Sistema móvil de control parental para Lux, con vinculación por código QR y comunicación mediante Web Service.',
    'about.github': 'Ver proyecto en GitHub',
    'about.courses': 'ASIGNATURAS INTEGRADAS',
    'about.footer': 'Fatec Indaiatuba Dr. Archimedes Lammoglia · 2026 · versión 0.9.0 (capa simulada)',
    'home.eyebrow': 'PIPLUP · CONTROL FAMILIAR', 'home.greeting': 'Hola, {name}', 'home.subtitle': 'Acompaña los ordenadores de tu familia.',
    'common.signOut': 'Salir', 'common.signingOut': 'Saliendo…', 'common.addComputer': 'Añadir ordenador', 'home.addDescription': 'Lee el código QR mostrado en Lux para vincular un ordenador nuevo.',
    'common.computers': 'Ordenadores', 'common.viewAll': 'Ver todos', 'common.loadingComputers': 'Cargando ordenadores…', 'common.loadError': 'No se pudo cargar', 'common.retry': 'Intentar de nuevo',
    'home.noneTitle': 'Ningún ordenador asociado', 'home.noneDescription': 'Lee el código QR temporal mostrado en el ordenador para crear un vínculo.', 'home.shortcuts': 'ATAJOS DE RESTRICCIÓN',
    'home.browsers': 'Navegadores', 'home.blocked': 'Bloqueados', 'home.apps': 'Aplicaciones', 'home.installed': 'Ver instaladas', 'home.installation': 'Instalación', 'home.age': 'Edad', 'home.upTo12': 'Hasta 12 años',
    'auth.tagline': 'Parental Insight Platform for Lux User Protection', 'auth.welcome': 'Bienvenido de nuevo', 'auth.loginDescription': 'Entra con tu cuenta de responsable para gestionar los ordenadores de la familia.',
    'common.email': 'Correo electrónico', 'common.password': 'Contraseña', 'auth.emailPlaceholder': 'responsable@email.com', 'auth.passwordPlaceholder': 'Escribe tu contraseña', 'auth.validEmail': 'Introduce un correo válido.',
    'auth.requiredPassword': 'Introduce tu contraseña.', 'common.show': 'Mostrar', 'common.hide': 'Ocultar', 'auth.signingIn': 'Entrando…', 'auth.signIn': 'Entrar', 'auth.retryConnection': 'Intentar conexión de nuevo',
    'auth.registerPrompt': '¿No tienes cuenta? Regístrate', 'auth.forgot': 'Olvidé mi contraseña', 'auth.forgotUnavailable': 'La recuperación de contraseña no está disponible ahora.', 'auth.createAccount': 'Crear cuenta',
    'auth.registerDescription': 'Regístrate como responsable para gestionar los ordenadores de la familia.', 'common.name': 'Nombre', 'auth.namePlaceholder': 'Tu nombre', 'auth.createPassword': 'Crea una contraseña',
    'auth.confirmPassword': 'Confirmar contraseña', 'auth.confirmPlaceholder': 'Repite la contraseña', 'auth.passwordMin': 'La contraseña debe tener al menos {count} caracteres.', 'auth.passwordMismatch': 'Las contraseñas no coinciden.',
    'auth.completed': 'Registro completado', 'auth.completedDescription': 'Cuenta simulada: no se guardó ni envió ningún dato porque todavía no hay backend. Vuelve al inicio de sesión para continuar.', 'auth.goLogin': 'Ir al inicio de sesión', 'auth.haveAccount': 'Ya tengo una cuenta',
    'restriction.sync': 'Sincronizado', 'restriction.syncing': 'Sincronizando', 'restriction.loadingComputer': 'Cargando ordenador…', 'restriction.noComputer': 'Ningún ordenador conectado', 'restriction.pairToContinue': 'Vincula un ordenador para continuar.', 'restriction.blockBrowsers': 'Bloquear navegadores', 'restriction.blockBrowsersDescription': 'Impide abrir cualquier navegador en la cuenta del niño.', 'restriction.allowedExceptions': 'EXCEPCIONES PERMITIDAS', 'restriction.browserFooter': 'Con el bloqueo general activo, solo los navegadores marcados siguen disponibles.', 'restriction.searchApp': 'Buscar aplicación', 'restriction.allowedApps': '{allowed} de {total} aplicaciones permitidas', 'restriction.restrictAll': 'Restringir todas', 'restriction.noAppMatch': 'Ninguna aplicación coincide con la búsqueda.', 'restriction.appsUnavailable': 'Aplicaciones no disponibles', 'restriction.installUnavailable': 'Solicitudes no disponibles', 'restriction.blockInstall': 'Bloquear instalación', 'restriction.blockInstallDescription': 'Las aplicaciones nuevas solo se pueden instalar con tu aprobación.', 'restriction.pendingRequests': 'SOLICITUDES PENDIENTES', 'restriction.noPendingRequests': 'Ninguna solicitud pendiente', 'restriction.newRequests': 'Las nuevas solicitudes enviadas por el ordenador aparecerán aquí.', 'restriction.allow': 'Permitir', 'restriction.deny': 'Rechazar', 'restriction.requestBy': 'Solicitado por {name} · {time}', 'restriction.ageAdjustment': 'Adecuación por edad', 'restriction.account': 'cuenta {name}', 'restriction.loadingAccountComputers': 'Cargando ordenadores de la cuenta…', 'restriction.computer': 'ORDENADOR', 'restriction.free': 'Libre', 'restriction.noAgeRestriction': 'Sin restricción de edad', 'restriction.age10': '10 años', 'restriction.age12': '12 años', 'restriction.age16': '16 años', 'restriction.age18': '18 años', 'restriction.contentLight': 'Contenido ligero, sin violencia', 'restriction.violenceLight': 'Violencia leve, lenguaje moderado', 'restriction.moderateAdult': 'Contenido adulto moderado', 'restriction.noRatingFilter': 'Sin filtro de clasificación',
  },
};

Object.assign(translations.es, {
  'pairing.eyebrow': 'VINCULACIÓN SEGURA',
  'pairing.title': 'Añadir ordenador',
  'pairing.description': 'Lee el código QR temporal mostrado en el ordenador. Comprueba los datos antes de crear el vínculo.',
  'pairing.demoCreated': 'Vínculo de demostración creado',
  'pairing.computerAssociated': 'Ordenador asociado',
  'pairing.demoNote': 'Este ordenador es una simulación. La integración real con Lux aún no ha sido validada.',
  'pairing.activeNote': 'El vínculo está activo. La conexión con Lux aún no ha sido validada.',
  'pairing.viewComputers': 'Ver ordenadores',
  'pairing.confirm': 'Confirma este ordenador',
  'pairing.managedAccount': 'Cuenta gestionada: {name}',
  'pairing.demoConfirm': 'Demostración: confirmar solo crea un vínculo de demostración; no prueba la integración con Lux.',
  'pairing.qrValid': 'QR válido hasta {time}',
  'pairing.creating': 'Creando vínculo…',
  'pairing.confirmLink': 'Confirmar vínculo',
  'common.cancel': 'Cancelar',
  'pairing.validating': 'Validando código QR…',
  'pairing.readAnother': 'Leer otro código QR',
  'pairing.cameraNeeded': 'Se necesita la cámara',
  'pairing.cameraDescription': 'El acceso se utiliza para leer códigos QR de vinculación.',
  'pairing.requestAccess': 'Solicitando acceso…',
  'pairing.enableCamera': 'Activar cámara',
  'pairing.openSettings': 'Abrir configuración',
  'pairing.qrNote': 'Código QR de un solo uso. No lo compartas; no se guarda en el dispositivo.',
});

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getDeviceLanguage(): Language {
  const languageTag = getLocales()[0]?.languageTag.toLowerCase() ?? '';

  if (languageTag.startsWith('pt')) return 'pt-BR';
  if (languageTag.startsWith('es')) return 'es';
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getDeviceLanguage);
  const manualPreference = useRef(false);

  useEffect(() => {
    void SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY)
      .then((storedLanguage) => {
        if (storedLanguage === 'pt-BR' || storedLanguage === 'en' || storedLanguage === 'es') {
          manualPreference.current = true;
          setLanguageState(storedLanguage);
        }
      })
      .catch(() => undefined);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !manualPreference.current) {
        setLanguageState(getDeviceLanguage());
      }
    });

    return () => subscription.remove();
  }, []);

  function setLanguage(nextLanguage: Language) {
    manualPreference.current = true;
    setLanguageState(nextLanguage);
    void SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, nextLanguage).catch(() => undefined);
  }

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, variables) => Object.entries(variables ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        translations[language][key] ?? key,
      ),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
