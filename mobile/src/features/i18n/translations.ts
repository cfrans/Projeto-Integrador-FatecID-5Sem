export type TranslationKey = string;

export type Language = 'pt-BR' | 'en' | 'es';

export const translations: Record<Language, Record<TranslationKey, string>> = {
  'pt-BR': {
    "device.refresh": "Atualizar computadores",
    "device.staleList": "Não foi possível atualizar. Os dados exibidos são da última consulta e podem estar desatualizados.",
    "restriction.clearSearch": "Limpar busca",
    "restriction.restrictAllDescription": "Restringir todos os {count} aplicativos de {name}, incluindo os que estão fora da busca atual? A alteração será enviada ao client simulado.",
    "device.changeIcon": "Alterar ícone de {name}",
    "device.iconTitle": "Ícone do computador",
    "device.icon.desktop": "Computador",
    "device.icon.laptop": "Notebook",
    "device.icon.gaming": "PC gamer",
    "device.icon.server": "Servidor",
    "device.iconLocalNote": "Sua escolha fica salva neste aparelho, para esta conta.",
    "device.iconLoadError": "Não foi possível carregar seus ícones. Tente novamente.",
    "device.iconSaveError": "Não foi possível salvar o ícone. Tente novamente.",
    'restriction.selectedComputer': 'Computador selecionado', 'restriction.change': 'Trocar', 'restriction.changeComputer': 'Trocar computador', 'common.close': 'Fechar',
    'simulation.title': 'Simulação', 'simulation.loading': 'Carregando configurações…', 'simulation.saving': 'Salvando configurações…', 'simulation.pending': 'Salvo · aguardando o client simulado', 'simulation.applied': 'Aplicado no client simulado', 'simulation.realUnavailable': 'A integração de restrições com PCs reais ainda não está disponível.',
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
    'about.theme.title': 'Tema',
    'about.theme.system': 'Sistema',
    'about.theme.light': 'Claro',
    'about.theme.dark': 'Escuro',
    'about.eyebrow': 'GRUPO 2 · FATEC INDAIATUBA',
    'about.title': 'Projeto Integrador · 5º trimestre',
    'about.description': 'Sistema mobile de controle parental para o Lux, com pareamento por QR Code e comunicação via Web Service.',
    'about.github': 'Ver projeto no GitHub',
    'about.courses': 'DISCIPLINAS INTEGRADAS',
    'about.footer': 'Fatec Indaiatuba Dr. Archimedes Lammoglia · 2026 · versão 0.9.0 (camada simulada)',
    'home.eyebrow': 'CONTROLE FAMILIAR', 'home.greeting': 'Olá, {name}.', 'home.subtitle': 'Acompanhe os computadores da sua família, gerencie navegadores, aplicativos e instalações e responda aos pedidos de liberação.',
    'common.signOut': 'Sair', 'common.signingOut': 'Saindo…', 'common.addComputer': 'Adicionar computador',
    'home.addDescription': 'Leia o QR Code exibido no computador ou no client simulado para criar o vínculo.', 'common.computers': 'Computadores',
    'common.viewAll': 'Ver todos', 'common.loadingComputers': 'Carregando computadores…', 'common.loadError': 'Não foi possível carregar',
    'common.retry': 'Tentar novamente', 'home.noneTitle': 'Nenhum computador associado', 'home.noneDescription': 'Leia o QR Code temporário exibido no computador para criar um vínculo.',
    'home.shortcuts': 'ATALHOS DE RESTRIÇÃO', 'home.browsers': 'Navegadores', 'home.blocked': 'Bloqueados', 'home.apps': 'Aplicativos',
    'home.installed': 'Ver instalados', 'home.installation': 'Instalação', 'home.age': 'Faixa etária', 'home.upTo12': 'Até 12 anos',
    'auth.tagline': 'Parental Insight Platform for Lux User Protection', 'auth.welcome': 'Bem-vindo\nde volta.',
    'auth.loginDescription': 'Acompanhe e gerencie os computadores da família em um só lugar.', 'common.email': 'E-mail',
    'common.password': 'Senha', 'auth.emailPlaceholder': 'responsavel@email.com', 'auth.passwordPlaceholder': 'Digite sua senha',
    'auth.validEmail': 'Informe um e-mail válido.', 'auth.requiredPassword': 'Informe sua senha.', 'common.show': 'Mostrar', 'common.hide': 'Ocultar',
    'auth.signingIn': 'Entrando…', 'auth.signIn': 'Entrar', 'auth.retryConnection': 'Tentar conexão novamente',
    'auth.registerPrompt': 'Não tem conta? Cadastre-se', 'auth.forgot': 'Esqueci minha senha', 'auth.forgotUnavailable': 'Recuperação de senha indisponível no momento.',
    'auth.createAccount': 'Criar conta', 'auth.registerDescription': 'Leva menos de um minuto para começar.', 'common.name': 'Nome',
    'auth.namePlaceholder': 'Seu nome', 'auth.createPassword': 'Crie uma senha', 'auth.confirmPassword': 'Confirmar senha',
    'auth.confirmPlaceholder': 'Repita a senha', 'auth.passwordMin': 'A senha deve ter ao menos {count} caracteres.', 'auth.passwordMismatch': 'As senhas não coincidem.',
    'auth.completed': 'Cadastro concluído', 'auth.completedDescription': 'Conta simulada: nenhum dado foi salvo ou enviado. O cadastro pela API ainda não está disponível.',
    'auth.goLogin': 'Ir para o login', 'auth.haveAccount': 'Já tenho conta',
    'restriction.sync': 'Sincronizado', 'restriction.syncing': 'Sincronizando', 'restriction.loadingComputer': 'Carregando computador…', 'restriction.noComputer': 'Nenhum computador conectado', 'restriction.pairToContinue': 'Faça o pareamento de um computador para continuar.',
    'restriction.blockBrowsers': 'Bloquear navegadores', 'restriction.blockBrowsersDescription': 'Impede a abertura de qualquer navegador na conta da criança.', 'restriction.allowedExceptions': 'EXCEÇÕES PERMITIDAS', 'restriction.browserFooter': 'Com o bloqueio geral ativo, apenas os navegadores marcados continuam disponíveis.',
    'restriction.searchApp': 'Buscar aplicativo', 'restriction.allowedApps': '{allowed} de {total} aplicativos liberados', 'restriction.restrictAll': 'Restringir todos', 'restriction.noAppMatch': 'Nenhum aplicativo corresponde à busca.', 'restriction.appsUnavailable': 'Aplicativos indisponíveis', 'restriction.installUnavailable': 'Pedidos indisponíveis',
    'restriction.blockInstall': 'Bloquear instalação', 'restriction.blockInstallDescription': 'Novos aplicativos só podem ser instalados com sua aprovação.', 'restriction.pendingRequests': 'PEDIDOS AGUARDANDO VOCÊ', 'restriction.noPendingRequests': 'Nenhum pedido pendente', 'restriction.newRequests': 'Novos pedidos enviados pelo computador aparecerão aqui.', 'restriction.allow': 'Permitir', 'restriction.deny': 'Recusar', 'restriction.requestBy': 'Pedido por {name} · {time}',
    'restriction.ageAdjustment': 'Adequação etária', 'restriction.account': 'conta {name}', 'restriction.loadingAccountComputers': 'Carregando computadores da conta…', 'restriction.computer': 'COMPUTADOR', 'restriction.free': 'Livre', 'restriction.noAgeRestriction': 'Sem restrição de idade', 'restriction.age10': '10 anos', 'restriction.age12': '12 anos', 'restriction.age16': '16 anos', 'restriction.age18': '18 anos', 'restriction.contentLight': 'Conteúdo leve, sem violência', 'restriction.violenceLight': 'Violência leve, linguagem branda', 'restriction.moderateAdult': 'Conteúdo adulto moderado', 'restriction.noRatingFilter': 'Sem filtro de classificação',
    'pairing.eyebrow': 'PAREAMENTO SEGURO', 'pairing.title': 'Adicionar computador', 'pairing.description': 'Leia o QR Code temporário exibido no computador. Confira os dados antes de criar o vínculo.', 'pairing.demoCreated': 'Vínculo de demonstração criado', 'pairing.computerAssociated': 'Computador associado', 'pairing.demoNote': 'Este computador é uma simulação. A integração real com o Lux ainda não foi validada.', 'pairing.activeNote': 'O vínculo está ativo. A conexão com o Lux ainda não foi validada.', 'pairing.viewComputers': 'Ver computadores', 'pairing.confirm': 'Confirme este computador', 'pairing.managedAccount': 'Conta gerenciada: {name}', 'pairing.demoConfirm': 'Demonstração: confirmar cria somente um vínculo de demonstração; não comprova integração com o Lux.', 'pairing.qrValid': 'QR válido até {time}', 'pairing.creating': 'Criando vínculo…', 'pairing.confirmLink': 'Confirmar vínculo', 'common.cancel': 'Cancelar', 'pairing.validating': 'Validando QR Code…', 'pairing.readAnother': 'Ler outro QR Code', 'pairing.cameraNeeded': 'A câmera é necessária', 'pairing.cameraDescription': 'O acesso é usado para ler QR Codes de pareamento.', 'pairing.requestAccess': 'Solicitando acesso…', 'pairing.enableCamera': 'Ativar câmera', 'pairing.openSettings': 'Abrir configurações', 'pairing.qrNote': 'QR temporário de uso único. Não compartilhe o código; ele não é salvo no aparelho.',
  },
  en: {
    "device.refresh": "Refresh computers",
    "device.staleList": "Could not refresh. Displayed data is from the last query and may be outdated.",
    "restriction.clearSearch": "Clear search",
    "restriction.restrictAllDescription": "Restrict all {count} applications on {name}, including those outside the current search? The change will be sent to the simulated client.",
    "device.changeIcon": "Change icon for {name}",
    "device.iconTitle": "Computer icon",
    "device.icon.desktop": "Desktop",
    "device.icon.laptop": "Laptop",
    "device.icon.gaming": "Gaming PC",
    "device.icon.server": "Server",
    "device.iconLocalNote": "Your choice is saved on this device for this account.",
    "device.iconLoadError": "Could not load your icons. Try again.",
    "device.iconSaveError": "Could not save the icon. Try again.",
    'restriction.selectedComputer': 'Selected computer', 'restriction.change': 'Change', 'restriction.changeComputer': 'Change computer', 'common.close': 'Close',
    'simulation.title': 'Simulation', 'simulation.loading': 'Loading settings…', 'simulation.saving': 'Saving settings…', 'simulation.pending': 'Saved · waiting for the simulated client', 'simulation.applied': 'Applied in the simulated client', 'simulation.realUnavailable': 'Restriction integration with real PCs is not available yet.',
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
    'about.theme.title': 'Theme',
    'about.theme.system': 'System',
    'about.theme.light': 'Light',
    'about.theme.dark': 'Dark',
    'about.eyebrow': 'GROUP 2 · FATEC INDAIATUBA',
    'about.title': 'Integrative Project · 5th term',
    'about.description': 'Mobile parental control system for Lux, with QR Code pairing and Web Service communication.',
    'about.github': 'View project on GitHub',
    'about.courses': 'INTEGRATED COURSES',
    'about.footer': 'Fatec Indaiatuba Dr. Archimedes Lammoglia · 2026 · version 0.9.0 (simulated layer)',
    'home.eyebrow': 'FAMILY CONTROL', 'home.greeting': 'Hello, {name}.', 'home.subtitle': 'Keep track of your family computers, manage browsers, apps and installations, and respond to access requests.',
    'common.signOut': 'Sign out', 'common.signingOut': 'Signing out…', 'common.addComputer': 'Add computer',
    'home.addDescription': 'Scan the QR Code shown on the computer or simulated client to create the link.', 'common.computers': 'Computers', 'common.viewAll': 'View all',
    'common.loadingComputers': 'Loading computers…', 'common.loadError': 'Could not load', 'common.retry': 'Try again',
    'home.noneTitle': 'No computer associated', 'home.noneDescription': 'Scan the temporary QR Code shown on the computer to create a link.',
    'home.shortcuts': 'RESTRICTION SHORTCUTS', 'home.browsers': 'Browsers', 'home.blocked': 'Blocked', 'home.apps': 'Apps', 'home.installed': 'View installed',
    'home.installation': 'Installation', 'home.age': 'Age rating', 'home.upTo12': 'Up to 12 years', 'auth.tagline': 'Parental Insight Platform for Lux User Protection',
    'auth.welcome': 'Welcome\nback.', 'auth.loginDescription': 'Keep track of and manage your family computers in one place.', 'common.email': 'Email',
    'common.password': 'Password', 'auth.emailPlaceholder': 'guardian@email.com', 'auth.passwordPlaceholder': 'Enter your password', 'auth.validEmail': 'Enter a valid email.',
    'auth.requiredPassword': 'Enter your password.', 'common.show': 'Show', 'common.hide': 'Hide', 'auth.signingIn': 'Signing in…', 'auth.signIn': 'Sign in',
    'auth.retryConnection': 'Try connection again', 'auth.registerPrompt': 'No account? Sign up', 'auth.forgot': 'Forgot my password', 'auth.forgotUnavailable': 'Password recovery is unavailable right now.',
    'auth.createAccount': 'Create account', 'auth.registerDescription': 'It takes less than a minute to get started.', 'common.name': 'Name', 'auth.namePlaceholder': 'Your name',
    'auth.createPassword': 'Create a password', 'auth.confirmPassword': 'Confirm password', 'auth.confirmPlaceholder': 'Repeat your password', 'auth.passwordMin': 'Password must have at least {count} characters.',
    'auth.passwordMismatch': 'Passwords do not match.', 'auth.completed': 'Registration complete', 'auth.completedDescription': 'Demo account: no data was saved or sent. Registration through the API is not available yet.',
    'auth.goLogin': 'Go to login', 'auth.haveAccount': 'I already have an account',
    'restriction.sync': 'Synced', 'restriction.syncing': 'Syncing', 'restriction.loadingComputer': 'Loading computer…', 'restriction.noComputer': 'No computer connected', 'restriction.pairToContinue': 'Pair a computer to continue.', 'restriction.blockBrowsers': 'Block browsers', 'restriction.blockBrowsersDescription': 'Prevents any browser from opening on the child account.', 'restriction.allowedExceptions': 'ALLOWED EXCEPTIONS', 'restriction.browserFooter': 'When general blocking is active, only marked browsers remain available.', 'restriction.searchApp': 'Search app', 'restriction.allowedApps': '{allowed} of {total} apps allowed', 'restriction.restrictAll': 'Restrict all', 'restriction.noAppMatch': 'No app matches the search.', 'restriction.appsUnavailable': 'Apps unavailable', 'restriction.installUnavailable': 'Requests unavailable', 'restriction.blockInstall': 'Block installation', 'restriction.blockInstallDescription': 'New apps can only be installed with your approval.', 'restriction.pendingRequests': 'REQUESTS WAITING FOR YOU', 'restriction.noPendingRequests': 'No pending requests', 'restriction.newRequests': 'New requests sent by the computer will appear here.', 'restriction.allow': 'Allow', 'restriction.deny': 'Deny', 'restriction.requestBy': 'Requested by {name} · {time}', 'restriction.ageAdjustment': 'Age suitability', 'restriction.account': 'account {name}', 'restriction.loadingAccountComputers': 'Loading account computers…', 'restriction.computer': 'COMPUTER', 'restriction.free': 'Everyone', 'restriction.noAgeRestriction': 'No age restriction', 'restriction.age10': '10 years', 'restriction.age12': '12 years', 'restriction.age16': '16 years', 'restriction.age18': '18 years', 'restriction.contentLight': 'Light content, no violence', 'restriction.violenceLight': 'Mild violence, mild language', 'restriction.moderateAdult': 'Moderate adult content', 'restriction.noRatingFilter': 'No rating filter',
    'pairing.eyebrow': 'SECURE PAIRING', 'pairing.title': 'Add computer', 'pairing.description': 'Scan the temporary QR Code shown on the computer. Check the details before creating the link.', 'pairing.demoCreated': 'Demo link created', 'pairing.computerAssociated': 'Computer associated', 'pairing.demoNote': 'This computer is a simulation. Real integration with Lux has not been validated yet.', 'pairing.activeNote': 'The link is active. Connection to Lux has not been validated yet.', 'pairing.viewComputers': 'View computers', 'pairing.confirm': 'Confirm this computer', 'pairing.managedAccount': 'Managed account: {name}', 'pairing.demoConfirm': 'Demo: confirming creates only a demo link; it does not prove Lux integration.', 'pairing.qrValid': 'QR valid until {time}', 'pairing.creating': 'Creating link…', 'pairing.confirmLink': 'Confirm link', 'common.cancel': 'Cancel', 'pairing.validating': 'Validating QR Code…', 'pairing.readAnother': 'Scan another QR Code', 'pairing.cameraNeeded': 'Camera required', 'pairing.cameraDescription': 'Access is used to scan pairing QR Codes.', 'pairing.requestAccess': 'Requesting access…', 'pairing.enableCamera': 'Enable camera', 'pairing.openSettings': 'Open settings', 'pairing.qrNote': 'One-time QR Code. Do not share it; it is not saved on the device.',
  },
  es: {
    "device.refresh": "Actualizar computadoras",
    "device.staleList": "No se pudo actualizar. Los datos mostrados son de la última consulta y pueden estar desactualizados.",
    "restriction.clearSearch": "Limpiar búsqueda",
    "restriction.restrictAllDescription": "¿Restringir las {count} aplicaciones de {name}, incluidas las que están fuera de la búsqueda actual? El cambio se enviará al cliente simulado.",
    "device.changeIcon": "Cambiar icono de {name}",
    "device.iconTitle": "Icono del ordenador",
    "device.icon.desktop": "Ordenador",
    "device.icon.laptop": "Portátil",
    "device.icon.gaming": "PC para juegos",
    "device.icon.server": "Servidor",
    "device.iconLocalNote": "Tu elección se guarda en este dispositivo para esta cuenta.",
    "device.iconLoadError": "No se pudieron cargar tus iconos. Inténtalo de nuevo.",
    "device.iconSaveError": "No se pudo guardar el icono. Inténtalo de nuevo.",
    'restriction.selectedComputer': 'Ordenador seleccionado', 'restriction.change': 'Cambiar', 'restriction.changeComputer': 'Cambiar ordenador', 'common.close': 'Cerrar',
    'simulation.title': 'Simulación', 'simulation.loading': 'Cargando configuración…', 'simulation.saving': 'Guardando configuración…', 'simulation.pending': 'Guardado · esperando al cliente simulado', 'simulation.applied': 'Aplicado en el cliente simulado', 'simulation.realUnavailable': 'La integración de restricciones con PCs reales aún no está disponible.',
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
    'about.theme.title': 'Tema',
    'about.theme.system': 'Sistema',
    'about.theme.light': 'Claro',
    'about.theme.dark': 'Oscuro',
    'about.eyebrow': 'GRUPO 2 · FATEC INDAIATUBA',
    'about.title': 'Proyecto Integrador · 5º trimestre',
    'about.description': 'Sistema móvil de control parental para Lux, con vinculación por código QR y comunicación mediante Web Service.',
    'about.github': 'Ver proyecto en GitHub',
    'about.courses': 'ASIGNATURAS INTEGRADAS',
    'about.footer': 'Fatec Indaiatuba Dr. Archimedes Lammoglia · 2026 · versión 0.9.0 (capa simulada)',
    'home.eyebrow': 'CONTROL FAMILIAR', 'home.greeting': 'Hola, {name}.', 'home.subtitle': 'Acompaña los ordenadores de tu familia, gestiona navegadores, aplicaciones e instalaciones y responde a las solicitudes de acceso.',
    'common.signOut': 'Salir', 'common.signingOut': 'Saliendo…', 'common.addComputer': 'Añadir ordenador', 'home.addDescription': 'Lee el código QR mostrado en el ordenador o cliente simulado para crear el vínculo.',
    'common.computers': 'Ordenadores', 'common.viewAll': 'Ver todos', 'common.loadingComputers': 'Cargando ordenadores…', 'common.loadError': 'No se pudo cargar', 'common.retry': 'Intentar de nuevo',
    'home.noneTitle': 'Ningún ordenador asociado', 'home.noneDescription': 'Lee el código QR temporal mostrado en el ordenador para crear un vínculo.', 'home.shortcuts': 'ATAJOS DE RESTRICCIÓN',
    'home.browsers': 'Navegadores', 'home.blocked': 'Bloqueados', 'home.apps': 'Aplicaciones', 'home.installed': 'Ver instaladas', 'home.installation': 'Instalación', 'home.age': 'Edad', 'home.upTo12': 'Hasta 12 años',
    'auth.tagline': 'Parental Insight Platform for Lux User Protection', 'auth.welcome': 'Bienvenido\nde nuevo.', 'auth.loginDescription': 'Acompaña y gestiona los ordenadores de la familia en un solo lugar.',
    'common.email': 'Correo electrónico', 'common.password': 'Contraseña', 'auth.emailPlaceholder': 'responsable@email.com', 'auth.passwordPlaceholder': 'Escribe tu contraseña', 'auth.validEmail': 'Introduce un correo válido.',
    'auth.requiredPassword': 'Introduce tu contraseña.', 'common.show': 'Mostrar', 'common.hide': 'Ocultar', 'auth.signingIn': 'Entrando…', 'auth.signIn': 'Entrar', 'auth.retryConnection': 'Intentar conexión de nuevo',
    'auth.registerPrompt': '¿No tienes cuenta? Regístrate', 'auth.forgot': 'Olvidé mi contraseña', 'auth.forgotUnavailable': 'La recuperación de contraseña no está disponible ahora.', 'auth.createAccount': 'Crear cuenta',
    'auth.registerDescription': 'Lleva menos de un minuto empezar.', 'common.name': 'Nombre', 'auth.namePlaceholder': 'Tu nombre', 'auth.createPassword': 'Crea una contraseña',
    'auth.confirmPassword': 'Confirmar contraseña', 'auth.confirmPlaceholder': 'Repite la contraseña', 'auth.passwordMin': 'La contraseña debe tener al menos {count} caracteres.', 'auth.passwordMismatch': 'Las contraseñas no coinciden.',
    'auth.completed': 'Registro completado', 'auth.completedDescription': 'Cuenta simulada: no se guardó ni envió ningún dato. El registro mediante la API aún no está disponible.', 'auth.goLogin': 'Ir al inicio de sesión', 'auth.haveAccount': 'Ya tengo una cuenta',
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

Object.assign(translations["pt-BR"], {
  "common.back": "Voltar",
  "common.notProvided": "não informada",
  "restriction.chooseComputer": "Selecione um computador para continuar.",
  "restriction.allowed": "permitido",
  "restriction.blocked": "bloqueado",
  "restriction.restricted": "restrito",
  "restriction.allowInstall": "Permitir instalação de {name}",
  "restriction.denyInstall": "Recusar instalação de {name}",
  "restriction.schoolBrowser": "GNOME Web (escola)",
  "restriction.ageDescription": "Escolha a faixa etária para o computador selecionado. O client simulado exibe essa preferência.",
  "restriction.sending": "Enviando alteração ao Web Service…",
  "device.managed": "Conta gerenciada",
  "device.demo": "Demonstração",
  "device.unverified": "Conexão não validada",
  "device.active": "Vínculo ativo",
  "device.inactive": "Sem vínculo ativo",
  "device.seen": "Visto em",
  "device.removing": "Removendo vínculo…",
  "device.remove": "Remover vínculo",
  "device.removeTitle": "Remover vínculo?",
  "device.removeDescription": "“{name}” deixará de aparecer entre os computadores associados à sua conta.",
  "device.removeHint": "Remove o vínculo de {name} da sua conta",
  "device.online": "Online",
  "device.offline": "Offline",
  "about.profileHint": "Abre o perfil do GitHub de {name}",
  "about.repositoryHint": "Abre o repositório oficial do projeto no GitHub",
  "about.course0": "Engenharia de Software III",
  "about.course1": "Laboratório de Banco de Dados",
  "about.course2": "Segurança da Informação",
  "about.course3": "Sistemas Operacionais II",
  "about.course4": "Programação para Dispositivos Móveis",
  "nav.paired": "Computador pareado",
  "nav.syncFailure": "Falha de sincronização",
  "pairing.cameraCheckFailed": "Não foi possível verificar a permissão da câmera.",
  "pairing.settingsFailed": "Não foi possível abrir as configurações. Ative a câmera nas permissões do aplicativo.",
  "pairing.cameraDenied": "A permissão da câmera foi negada. Ative o acesso nas configurações para ler o QR Code.",
  "pairing.cameraAccessFailed": "Não foi possível acessar a câmera. Verifique a permissão e tente novamente.",
  "pairing.cameraStartFailed": "Não foi possível iniciar a câmera. Tente novamente.",
  "error.sessionExpired": "Sua sessão expirou. Entre novamente.",
  "error.failed": "Não foi possível concluir a solicitação. Tente novamente.",
  "error.credentials": "E-mail ou senha incorretos.",
  "error.devices": "A API retornou uma lista de dispositivos inválida.",
  "error.apps": "A API retornou uma lista de aplicativos inválida.",
  "error.requests": "A API retornou uma lista de pedidos de instalação inválida."
});

Object.assign(translations["en"], {
  "common.back": "Back",
  "common.notProvided": "not provided",
  "restriction.chooseComputer": "Select a computer to continue.",
  "restriction.allowed": "allowed",
  "restriction.blocked": "blocked",
  "restriction.restricted": "restricted",
  "restriction.allowInstall": "Allow installation of {name}",
  "restriction.denyInstall": "Deny installation of {name}",
  "restriction.schoolBrowser": "GNOME Web (school)",
  "restriction.ageDescription": "Choose an age rating for the selected computer. The simulated client displays this preference.",
  "restriction.sending": "Sending change to the Web Service…",
  "device.managed": "Managed account",
  "device.demo": "Demo",
  "device.unverified": "Connection not verified",
  "device.active": "Active link",
  "device.inactive": "No active link",
  "device.seen": "Last seen",
  "device.removing": "Removing link…",
  "device.remove": "Remove link",
  "device.removeTitle": "Remove link?",
  "device.removeDescription": "“{name}” will no longer appear among the computers linked to your account.",
  "device.removeHint": "Removes the link to {name} from your account",
  "device.online": "Online",
  "device.offline": "Offline",
  "about.profileHint": "Opens the GitHub profile of {name}",
  "about.repositoryHint": "Opens the official project repository on GitHub",
  "about.course0": "Software Engineering III",
  "about.course1": "Database Laboratory",
  "about.course2": "Information Security",
  "about.course3": "Operating Systems II",
  "about.course4": "Mobile Device Programming",
  "nav.paired": "Computer paired",
  "nav.syncFailure": "Synchronization failed",
  "pairing.cameraCheckFailed": "Could not check camera permission.",
  "pairing.settingsFailed": "Could not open settings. Enable the camera in app permissions.",
  "pairing.cameraDenied": "Camera permission was denied. Enable access in settings to scan the QR Code.",
  "pairing.cameraAccessFailed": "Could not access the camera. Check permission and try again.",
  "pairing.cameraStartFailed": "Could not start the camera. Try again.",
  "error.sessionExpired": "Your session expired. Sign in again.",
  "error.failed": "Could not complete the request. Try again.",
  "error.credentials": "Incorrect email or password.",
  "error.devices": "The API returned an invalid device list.",
  "error.apps": "The API returned an invalid application list.",
  "error.requests": "The API returned an invalid installation request list."
});

Object.assign(translations["es"], {
  "common.back": "Volver",
  "common.notProvided": "no indicada",
  "restriction.chooseComputer": "Selecciona un ordenador para continuar.",
  "restriction.allowed": "permitido",
  "restriction.blocked": "bloqueado",
  "restriction.restricted": "restringido",
  "restriction.allowInstall": "Permitir instalación de {name}",
  "restriction.denyInstall": "Rechazar instalación de {name}",
  "restriction.schoolBrowser": "GNOME Web (escuela)",
  "restriction.ageDescription": "Elige la clasificación para el ordenador seleccionado. El cliente simulado muestra esta preferencia.",
  "restriction.sending": "Enviando cambio al Web Service…",
  "device.managed": "Cuenta gestionada",
  "device.demo": "Demostración",
  "device.unverified": "Conexión no validada",
  "device.active": "Vínculo activo",
  "device.inactive": "Sin vínculo activo",
  "device.seen": "Visto el",
  "device.removing": "Quitando vínculo…",
  "device.remove": "Quitar vínculo",
  "device.removeTitle": "¿Quitar vínculo?",
  "device.removeDescription": "“{name}” dejará de aparecer entre los ordenadores vinculados a tu cuenta.",
  "device.removeHint": "Quita el vínculo de {name} de tu cuenta",
  "device.online": "En línea",
  "device.offline": "Sin conexión",
  "about.profileHint": "Abre el perfil de GitHub de {name}",
  "about.repositoryHint": "Abre el repositorio oficial del proyecto en GitHub",
  "about.course0": "Ingeniería de Software III",
  "about.course1": "Laboratorio de Bases de Datos",
  "about.course2": "Seguridad de la Información",
  "about.course3": "Sistemas Operativos II",
  "about.course4": "Programación para Dispositivos Móviles",
  "nav.paired": "Ordenador vinculado",
  "nav.syncFailure": "Error de sincronización",
  "pairing.cameraCheckFailed": "No se pudo comprobar el permiso de la cámara.",
  "pairing.settingsFailed": "No se pudo abrir la configuración. Activa la cámara en los permisos de la aplicación.",
  "pairing.cameraDenied": "Se denegó el permiso de la cámara. Activa el acceso en la configuración para leer el código QR.",
  "pairing.cameraAccessFailed": "No se pudo acceder a la cámara. Comprueba el permiso e inténtalo de nuevo.",
  "pairing.cameraStartFailed": "No se pudo iniciar la cámara. Inténtalo de nuevo.",
  "error.sessionExpired": "Tu sesión ha caducado. Inicia sesión de nuevo.",
  "error.failed": "No se pudo completar la solicitud. Inténtalo de nuevo.",
  "error.credentials": "Correo o contraseña incorrectos.",
  "error.devices": "La API devolvió una lista de dispositivos no válida.",
  "error.apps": "La API devolvió una lista de aplicaciones no válida.",
  "error.requests": "La API devolvió una lista de solicitudes de instalación no válida."
});

Object.assign(translations["pt-BR"], {
  "error.detail0": "API não configurada. Inicie o Expo no modo LAN ou defina EXPO_PUBLIC_API_URL.",
  "error.detail1": "A URL da API é inválida. Use uma URL HTTP ou HTTPS sem credenciais, consulta ou fragmento.",
  "error.detail2": "Não foi possível acessar a sessão segura. Tente novamente.",
  "error.detail3": "A sessão expirou, mas não foi possível removê-la do armazenamento seguro.",
  "error.detail4": "Não foi possível proteger a sessão neste dispositivo.",
  "error.detail5": "Não foi possível encerrar a sessão no armazenamento seguro. Tente novamente.",
  "error.detail6": "Este QR Code não tem um formato válido. Aponte a câmera para um QR de pareamento.",
  "error.detail7": "Este QR Code expirou, já foi usado ou foi revogado. Gere um novo no computador.",
  "error.detail8": "Este computador já tem outro responsável ativo.",
  "error.detail9": "A API retornou uma resposta de pareamento inválida.",
  "error.detail10": "Não foi possível concluir a solicitação. Confira sua conexão e tente novamente.",
  "error.detail11": "A resposta do pareamento não chegou. Confira a lista de computadores antes de tentar novamente.",
  "error.detail12": "Não foi possível conectar à API em {url}. Confira a rede e se o backend está iniciado."
});

Object.assign(translations["en"], {
  "error.detail0": "API not configured. Start Expo in LAN mode or set EXPO_PUBLIC_API_URL.",
  "error.detail1": "Invalid API URL. Use an HTTP or HTTPS URL without credentials, query or fragment.",
  "error.detail2": "Could not access the secure session. Try again.",
  "error.detail3": "The session expired but could not be removed from secure storage.",
  "error.detail4": "Could not secure the session on this device.",
  "error.detail5": "Could not end the session in secure storage. Try again.",
  "error.detail6": "Invalid QR Code format. Point the camera at a pairing QR Code.",
  "error.detail7": "This QR Code expired, was already used or was revoked. Generate a new one on the computer.",
  "error.detail8": "This computer already has another active guardian.",
  "error.detail9": "The API returned an invalid pairing response.",
  "error.detail10": "Could not complete the request. Check your connection and try again.",
  "error.detail11": "The pairing response did not arrive. Check the computer list before trying again.",
  "error.detail12": "Could not connect to the API at {url}. Check the network and whether the backend is running."
});

Object.assign(translations["es"], {
  "error.detail0": "API no configurada. Inicia Expo en modo LAN o configura EXPO_PUBLIC_API_URL.",
  "error.detail1": "URL de API no válida. Usa una URL HTTP o HTTPS sin credenciales, consulta ni fragmento.",
  "error.detail2": "No se pudo acceder a la sesión segura. Inténtalo de nuevo.",
  "error.detail3": "La sesión caducó, pero no se pudo eliminar del almacenamiento seguro.",
  "error.detail4": "No se pudo proteger la sesión en este dispositivo.",
  "error.detail5": "No se pudo cerrar la sesión en el almacenamiento seguro. Inténtalo de nuevo.",
  "error.detail6": "Formato de código QR no válido. Apunta la cámara a un QR de vinculación.",
  "error.detail7": "Este código QR caducó, ya se usó o se revocó. Genera uno nuevo en el ordenador.",
  "error.detail8": "Este ordenador ya tiene otro responsable activo.",
  "error.detail9": "La API devolvió una respuesta de vinculación no válida.",
  "error.detail10": "No se pudo completar la solicitud. Comprueba la conexión e inténtalo de nuevo.",
  "error.detail11": "No llegó la respuesta de vinculación. Consulta la lista de ordenadores antes de intentarlo de nuevo.",
  "error.detail12": "No se pudo conectar a la API en {url}. Comprueba la red y si el backend está iniciado."
});

Object.assign(translations["pt-BR"], {
  "error.service0": "Computador pareado não encontrado.",
  "error.service1": "Inventário de aplicativos ainda não recebido do computador.",
  "error.service2": "Lista de pedidos de instalação ainda não recebida do computador.",
  "error.service3": "Serviço de aplicativos indisponível.",
  "error.service4": "Serviço de pedidos de instalação indisponível.",
  "error.service5": "Serviço de dispositivos indisponível.",
  "error.service6": "A API retornou uma sessão inválida.",
  "error.service7": "A API retornou um responsável inválido."
});

Object.assign(translations["en"], {
  "error.service0": "Paired computer not found.",
  "error.service1": "Application inventory has not been received from the computer yet.",
  "error.service2": "Installation request list has not been received from the computer yet.",
  "error.service3": "Application service unavailable.",
  "error.service4": "Installation request service unavailable.",
  "error.service5": "Device service unavailable.",
  "error.service6": "The API returned an invalid session.",
  "error.service7": "The API returned an invalid guardian."
});

Object.assign(translations["es"], {
  "error.service0": "Ordenador vinculado no encontrado.",
  "error.service1": "Aún no se ha recibido el inventario de aplicaciones del ordenador.",
  "error.service2": "Aún no se ha recibido la lista de solicitudes de instalación del ordenador.",
  "error.service3": "Servicio de aplicaciones no disponible.",
  "error.service4": "Servicio de solicitudes de instalación no disponible.",
  "error.service5": "Servicio de dispositivos no disponible.",
  "error.service6": "La API devolvió una sesión no válida.",
  "error.service7": "La API devolvió un responsable no válido."
});

Object.assign(translations['pt-BR'], { 'restriction.noApplications': 'Nenhum aplicativo instalado.' });
Object.assign(translations.en, { 'restriction.noApplications': 'No applications installed.' });
Object.assign(translations.es, { 'restriction.noApplications': 'Ninguna aplicación instalada.' });

Object.assign(translations["pt-BR"], {
  "home.manageBrowsers": "Gerenciar permissões",
  "home.manageInstall": "Revisar instalações",
  "home.manageAge": "Escolher faixa etária",
  "restriction.ageSummary": "Faixa escolhida: {age}. O inventário ainda não informa a classificação dos aplicativos; não há contagem de bloqueios por idade.",
  "simulation.clientonline": "Client simulado conectado",
  "simulation.clientoffline": "Client simulado desconectado",
  "simulation.clientunverified": "Aguardando primeira comunicação do client",
  "simulation.connectionUnknown": "Não foi possível atualizar a conexão",
  "simulation.lastContact": "Último contato às {time}"
});

Object.assign(translations["en"], {
  "home.manageBrowsers": "Manage permissions",
  "home.manageInstall": "Review installations",
  "home.manageAge": "Choose age rating",
  "restriction.ageSummary": "Selected rating: {age}. The inventory does not yet include app age ratings; a count of apps blocked by age is unavailable.",
  "simulation.clientonline": "Simulated client connected",
  "simulation.clientoffline": "Simulated client disconnected",
  "simulation.clientunverified": "Waiting for the first client contact",
  "simulation.connectionUnknown": "Could not refresh connection status",
  "simulation.lastContact": "Last contact at {time}"
});

Object.assign(translations["es"], {
  "home.manageBrowsers": "Gestionar permisos",
  "home.manageInstall": "Revisar instalaciones",
  "home.manageAge": "Elegir clasificación",
  "restriction.ageSummary": "Clasificación elegida: {age}. El inventario aún no incluye la clasificación de las aplicaciones; no hay un recuento de bloqueos por edad.",
  "simulation.clientonline": "Cliente simulado conectado",
  "simulation.clientoffline": "Cliente simulado desconectado",
  "simulation.clientunverified": "Esperando el primer contacto del cliente",
  "simulation.connectionUnknown": "No se pudo actualizar la conexión",
  "simulation.lastContact": "Último contacto a las {time}"
});

Object.assign(translations["pt-BR"], {
  "access.banner": "Aguardando sua resposta",
  "access.computer": "Computador",
  "access.account": "Conta",
  "access.blockedBy": "Bloqueado por",
  "access.blockedByInstall": "Instalação de aplicativos",
  "access.requestedAt": "Pedido em",
  "access.allowLimited": "Permitir com limite de tempo",
  "access.deny": "Recusar pedido",
  "access.responseNote": "{name} recebe a resposta quando o computador sincronizar. Enquanto não houver resposta, o bloqueio continua.",
  "access.timeSection": "TEMPO DE LIBERAÇÃO",
  "access.option.min30": "30 minutos",
  "access.option.hour1": "1 hora",
  "access.option.hour2": "2 horas",
  "access.option.bedtime": "Até dormir",
  "access.option.week": "Esta semana",
  "access.option.unlimited": "Sem limite",
  "access.until": "até {time}",
  "access.perDay": "2 h por dia",
  "access.fixed": "liberação fixa",
  "access.blockAtEnd": "Bloquear ao fim do tempo",
  "access.blockAtEndDescription": "O aplicativo fecha sozinho e volta à lista de bloqueados.",
  "access.confirm": "Confirmar liberação",
  "access.localNotice": "Por enquanto, o prazo fica registrado só neste aparelho: o computador ainda não bloqueia o aplicativo sozinho no fim do tempo.",
  "access.released": "{app} liberado",
  "access.releasedUntilBlock": "Liberado às {start} · encerra às {end} e volta a bloquear sozinho.",
  "access.releasedUntil": "Liberado às {start} · encerra às {end}.",
  "access.releasedFixed": "Liberado às {start} · sem limite de tempo.",
  "access.releasedNoDetail": "Liberação enviada. O prazo não está disponível neste aparelho.",
  "access.remaining": "Tempo restante",
  "access.remainingOf": "{left} de {total}",
  "access.ended": "Prazo encerrado",
  "access.endNow": "Encerrar liberação agora",
  "access.backHome": "Voltar ao início",
  "access.denied": "{app} recusado",
  "access.deniedDetail": "O pedido foi recusado e o bloqueio continua.",
  "access.notPending": "Este pedido não está mais pendente.",
  "access.minutes": "{n} min",
  "access.hours": "{n} h",
  "access.hoursMinutes": "{h} h {m} min",
  "access.homeTitle": "{name} pediu acesso a {app}",
  "access.homeCount": "{count} pedidos aguardando"
});

Object.assign(translations["en"], {
  "access.banner": "Waiting for your response",
  "access.computer": "Computer",
  "access.account": "Account",
  "access.blockedBy": "Blocked by",
  "access.blockedByInstall": "App installation",
  "access.requestedAt": "Requested at",
  "access.allowLimited": "Allow with time limit",
  "access.deny": "Deny request",
  "access.responseNote": "{name} gets the answer when the computer syncs. Until then, the block stays in place.",
  "access.timeSection": "RELEASE TIME",
  "access.option.min30": "30 minutes",
  "access.option.hour1": "1 hour",
  "access.option.hour2": "2 hours",
  "access.option.bedtime": "Until bedtime",
  "access.option.week": "This week",
  "access.option.unlimited": "No limit",
  "access.until": "until {time}",
  "access.perDay": "2 h per day",
  "access.fixed": "fixed release",
  "access.blockAtEnd": "Block when time ends",
  "access.blockAtEndDescription": "The app closes by itself and returns to the blocked list.",
  "access.confirm": "Confirm release",
  "access.localNotice": "For now, the time limit is recorded only on this device: the computer does not block the app by itself when time runs out.",
  "access.released": "{app} released",
  "access.releasedUntilBlock": "Released at {start} · ends at {end} and blocks again by itself.",
  "access.releasedUntil": "Released at {start} · ends at {end}.",
  "access.releasedFixed": "Released at {start} · no time limit.",
  "access.releasedNoDetail": "Release sent. The time limit is not available on this device.",
  "access.remaining": "Time left",
  "access.remainingOf": "{left} of {total}",
  "access.ended": "Time is up",
  "access.endNow": "End release now",
  "access.backHome": "Back to home",
  "access.denied": "{app} denied",
  "access.deniedDetail": "The request was denied and the block stays in place.",
  "access.notPending": "This request is no longer pending.",
  "access.minutes": "{n} min",
  "access.hours": "{n} h",
  "access.hoursMinutes": "{h} h {m} min",
  "access.homeTitle": "{name} requested access to {app}",
  "access.homeCount": "{count} requests waiting"
});

Object.assign(translations["es"], {
  "access.banner": "Esperando tu respuesta",
  "access.computer": "Ordenador",
  "access.account": "Cuenta",
  "access.blockedBy": "Bloqueado por",
  "access.blockedByInstall": "Instalación de aplicaciones",
  "access.requestedAt": "Solicitado el",
  "access.allowLimited": "Permitir con límite de tiempo",
  "access.deny": "Rechazar solicitud",
  "access.responseNote": "{name} recibe la respuesta cuando el ordenador sincronice. Mientras tanto, el bloqueo continúa.",
  "access.timeSection": "TIEMPO DE ACCESO",
  "access.option.min30": "30 minutos",
  "access.option.hour1": "1 hora",
  "access.option.hour2": "2 horas",
  "access.option.bedtime": "Hasta dormir",
  "access.option.week": "Esta semana",
  "access.option.unlimited": "Sin límite",
  "access.until": "hasta {time}",
  "access.perDay": "2 h por día",
  "access.fixed": "acceso fijo",
  "access.blockAtEnd": "Bloquear al terminar el tiempo",
  "access.blockAtEndDescription": "La aplicación se cierra sola y vuelve a la lista de bloqueadas.",
  "access.confirm": "Confirmar acceso",
  "access.localNotice": "Por ahora, el plazo queda registrado solo en este dispositivo: el ordenador aún no bloquea la aplicación por sí solo al terminar el tiempo.",
  "access.released": "{app} permitida",
  "access.releasedUntilBlock": "Permitida a las {start} · termina a las {end} y vuelve a bloquearse sola.",
  "access.releasedUntil": "Permitida a las {start} · termina a las {end}.",
  "access.releasedFixed": "Permitida a las {start} · sin límite de tiempo.",
  "access.releasedNoDetail": "Acceso enviado. El plazo no está disponible en este dispositivo.",
  "access.remaining": "Tiempo restante",
  "access.remainingOf": "{left} de {total}",
  "access.ended": "Plazo terminado",
  "access.endNow": "Terminar acceso ahora",
  "access.backHome": "Volver al inicio",
  "access.denied": "{app} rechazada",
  "access.deniedDetail": "La solicitud fue rechazada y el bloqueo continúa.",
  "access.notPending": "Esta solicitud ya no está pendiente.",
  "access.minutes": "{n} min",
  "access.hours": "{n} h",
  "access.hoursMinutes": "{h} h {m} min",
  "access.homeTitle": "{name} pidió acceso a {app}",
  "access.homeCount": "{count} solicitudes pendientes"
});

Object.assign(translations['pt-BR'], { 'nav.settings': 'Configurações', 'menu.open': 'Abrir menu', 'menu.close': 'Fechar menu' });
Object.assign(translations.en, { 'nav.settings': 'Settings', 'menu.open': 'Open menu', 'menu.close': 'Close menu' });
Object.assign(translations.es, { 'nav.settings': 'Configuración', 'menu.open': 'Abrir menú', 'menu.close': 'Cerrar menú' });

Object.assign(translations['pt-BR'], {
  'settings.account': 'Sua conta', 'settings.changeEmail': 'Alterar e-mail', 'settings.newEmail': 'Novo e-mail', 'settings.saveEmail': 'Salvar e-mail',
  'settings.changePassword': 'Alterar senha', 'settings.currentPassword': 'Senha atual', 'settings.newPassword': 'Nova senha', 'settings.savePassword': 'Salvar senha',
  'settings.notSaved': 'Dados validados, mas ainda não enviados: a alteração de conta depende do backend.',
});
Object.assign(translations.en, {
  'settings.account': 'Your account', 'settings.changeEmail': 'Change email', 'settings.newEmail': 'New email', 'settings.saveEmail': 'Save email',
  'settings.changePassword': 'Change password', 'settings.currentPassword': 'Current password', 'settings.newPassword': 'New password', 'settings.savePassword': 'Save password',
  'settings.notSaved': 'Data validated but not sent yet: account changes depend on the backend.',
});
Object.assign(translations.es, {
  'settings.account': 'Tu cuenta', 'settings.changeEmail': 'Cambiar correo', 'settings.newEmail': 'Nuevo correo', 'settings.saveEmail': 'Guardar correo',
  'settings.changePassword': 'Cambiar contraseña', 'settings.currentPassword': 'Contraseña actual', 'settings.newPassword': 'Nueva contraseña', 'settings.savePassword': 'Guardar contraseña',
  'settings.notSaved': 'Datos validados, pero aún no enviados: el cambio de cuenta depende del backend.',
});

Object.assign(translations['pt-BR'], { 'auth.eyebrow': 'ÁREA DO RESPONSÁVEL' });
Object.assign(translations.en, { 'auth.eyebrow': 'GUARDIAN AREA' });
Object.assign(translations.es, { 'auth.eyebrow': 'ÁREA DEL RESPONSABLE' });

Object.assign(translations['pt-BR'], { 'auth.registerQuestion': 'Não tem conta?', 'auth.registerAction': 'Cadastre-se' });
Object.assign(translations.en, { 'auth.registerQuestion': 'No account?', 'auth.registerAction': 'Sign up' });
Object.assign(translations.es, { 'auth.registerQuestion': '¿No tienes cuenta?', 'auth.registerAction': 'Regístrate' });

Object.assign(translations['pt-BR'], { 'auth.registerEyebrow': 'NOVA CONTA DE RESPONSÁVEL', 'auth.registerTitle': 'Criar conta.', 'auth.back': 'Voltar', 'auth.passwordHint': 'Mínimo de {count} caracteres' });
Object.assign(translations.en, { 'auth.registerEyebrow': 'NEW GUARDIAN ACCOUNT', 'auth.registerTitle': 'Create account.', 'auth.back': 'Back', 'auth.passwordHint': 'At least {count} characters' });
Object.assign(translations.es, { 'auth.registerEyebrow': 'NUEVA CUENTA DE RESPONSABLE', 'auth.registerTitle': 'Crear cuenta.', 'auth.back': 'Volver', 'auth.passwordHint': 'Mínimo {count} caracteres' });

Object.assign(translations['pt-BR'], { 'auth.haveAccountQuestion': 'Já tem uma conta?' });
Object.assign(translations.en, { 'auth.haveAccountQuestion': 'Already have an account?' });
Object.assign(translations.es, { 'auth.haveAccountQuestion': '¿Ya tienes una cuenta?' });

Object.assign(translations['pt-BR'], { 'settings.bedtime': 'Horário de dormir', 'settings.bedtimeDescription': 'Define o fim da opção "Até dormir" ao liberar um pedido. Fica salvo apenas neste aparelho.', 'settings.bedtimeLabel': 'Horário (HH:MM)', 'settings.saveBedtime': 'Salvar horário', 'settings.bedtimeInvalid': 'Use o formato HH:MM, de 00:00 a 23:59.', 'settings.bedtimeSaved': 'Horário salvo neste aparelho.' });
Object.assign(translations.en, { 'settings.bedtime': 'Bedtime', 'settings.bedtimeDescription': 'Sets the end of the "Until bedtime" option when releasing a request. Saved on this device only.', 'settings.bedtimeLabel': 'Time (HH:MM)', 'settings.saveBedtime': 'Save time', 'settings.bedtimeInvalid': 'Use the HH:MM format, from 00:00 to 23:59.', 'settings.bedtimeSaved': 'Time saved on this device.' });
Object.assign(translations.es, { 'settings.bedtime': 'Hora de dormir', 'settings.bedtimeDescription': 'Define el fin de la opción "Hasta dormir" al permitir una solicitud. Se guarda solo en este dispositivo.', 'settings.bedtimeLabel': 'Hora (HH:MM)', 'settings.saveBedtime': 'Guardar hora', 'settings.bedtimeInvalid': 'Usa el formato HH:MM, de 00:00 a 23:59.', 'settings.bedtimeSaved': 'Hora guardada en este dispositivo.' });
Object.assign(translations['pt-BR'], { 'nav.requests': 'Pedidos de liberação' });
Object.assign(translations.en, { 'nav.requests': 'Access requests' });
Object.assign(translations.es, { 'nav.requests': 'Solicitudes de acceso' });
Object.assign(translations['pt-BR'], { 'access.heading': '{name} quer utilizar', 'access.ago': 'há {n} min' });
Object.assign(translations.en, { 'access.heading': '{name} wants to use', 'access.ago': '{n} min ago' });
Object.assign(translations.es, { 'access.heading': '{name} quiere utilizar', 'access.ago': 'hace {n} min' });
Object.assign(translations['pt-BR'], { 'access.empty': 'Nenhum pedido pendente.', 'access.demoTag': 'Demonstração', 'access.demoWants': '{name} quer utilizar', 'access.demoAgo': 'há {n} min', 'access.demoRefuse': 'Recusar', 'access.demoRelease': 'Liberar' });
Object.assign(translations.en, { 'access.empty': 'No pending requests.', 'access.demoTag': 'Demo', 'access.demoWants': '{name} wants to use', 'access.demoAgo': '{n} min ago', 'access.demoRefuse': 'Deny', 'access.demoRelease': 'Allow' });
Object.assign(translations.es, { 'access.empty': 'Ninguna solicitud pendiente.', 'access.demoTag': 'Demostración', 'access.demoWants': '{name} quiere utilizar', 'access.demoAgo': 'hace {n} min', 'access.demoRefuse': 'Rechazar', 'access.demoRelease': 'Permitir' });

export function deviceLanguage(languageTag: string): Language {
  const tag = languageTag.toLowerCase();
  if (tag === 'pt' || tag.startsWith('pt-')) return 'pt-BR';
  if (tag === 'es' || tag.startsWith('es-')) return 'es';
  return 'en';
}

export function translate(language: Language, key: string, variables?: Record<string, string | number>) {
  return (translations[language][key] ?? key).replace(/\{(\w+)\}/g, (match, name: string) => String(variables?.[name] ?? match));
}

export function localizeMessage(language: Language, message: string) {
  const connection = /^Não foi possível conectar à API em (.+)\. Confira a rede e se o backend está iniciado\.$/.exec(message);
  if (connection) return translate(language, 'error.detail12', { url: connection[1] });
  const key = Object.keys(translations['pt-BR']).find((key) => translations['pt-BR'][key] === message);
  return key ? translate(language, key) : message;
}
