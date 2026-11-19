# Segurança

O que o sistema protege e o que fica como limitação conhecida. Detalhes de cada controle estão no documento da área, linkado em cada item.

## Controles implementados

- **Senhas e sessão.** Senhas e respostas de segurança com Argon2id. JWT HS256 de 30 minutos com emissor e audiência validados; `JWT_SECRET` obrigatório, com pelo menos 32 bytes e sem valor padrão. Cada requisição confere se o responsável ainda existe ([Backend](../backend/api.md#autenticação-implementada)).
- **Rotas públicas.** Limite de tentativas por IP: login e cadastro 20/min, cada rota de recuperação 5/min, autorregistro do Agent 5/min. Login usa a mesma mensagem e o mesmo custo de Argon2id para conta inexistente e senha errada.
- **Recuperação de senha.** Não revela se o e-mail existe: e-mail sem conta ou sem pergunta recebe uma pergunta fictícia estável, e toda resposta errada recebe o mesmo `400`.
- **Entrada da API.** `ValidationPipe` com `whitelist` e `forbidNonWhitelisted`, corpo JSON limitado a 16 KiB. Respostas nunca trazem hashes. O backend não registra corpos nem segredos em log. Swagger fica desligado com `NODE_ENV=production`.
- **Autorização.** Rotas do responsável filtram pelo responsável autenticado e exigem vínculo ativo (recurso alheio responde `404`). Rotas do Agent derivam o computador da credencial, nunca do corpo. O responsável não cria comandos parentais diretamente; eles nascem das configurações, com parâmetros normalizados.
- **Pareamento.** Token aleatório de cinco minutos e uso único, só com o hash no banco; o QR não leva credencial nem URL. Pedir o QR exige senha de administrador local (`pkexec` com `auth_admin`) ([Integração Lux](../lux/integration.md#pareamento-pelo-agent)).
- **Agent no Lux.** Roda como usuário de sistema `lux-agent`, sem login nem sudo, dentro de uma unit systemd restrita. Exige HTTPS com certificado verificado (HTTP só em loopback com opção explícita), recusa redirecionamentos e ignora proxies. Só executa a lista fechada de comandos, sem shell; a conta gerenciada é configuração local que só root altera, e contas administrativas (`sudo`, `admin`, `wheel`) são recusadas. Credencial em `/etc/lux-agent/credential`, `0600`, aberta com `O_NOFOLLOW` e checagem de dono. Logs sem credencial, Bearer ou corpo HTTP ([Lux Agent](../../lux-agent/README.md#instalar-como-serviço)).
- **Segredos no repositório.** `.env` e `mobile/.env.local` são ignorados pelo Git; só os `.example`, sem valores, são versionados.

## Limitações

| Limitação | Efeito | Por que fica |
| --- | --- | --- |
| JWT sem revogação | Sair do app só apaga o token local; trocar ou redefinir a senha não derruba sessões abertas. Uma cópia do token vale até expirar (30 min). | Planejado à parte (versão do token no responsável e `POST /auth/logout`). |
| Credencial do Agent sem expiração | A credencial vale até o vínculo ou a identidade serem revogados. Copiá-la exige root no Lux. | Rotação automática exigiria mudar o protocolo; a revogação cobre o caso de comprometimento. |
| malcontent bloqueia só no GNOME | O app some do menu e da busca, mas abre pelo terminal (`/usr/bin/...`); janelas já abertas continuam. | Comportamento do malcontent. Mitigação: bloquear também o app de terminal. |
| Regra polkit ampla | A regra deixa o usuário `lux-agent` alterar o filtro de apps de qualquer conta; quem restringe à conta gerenciada é o código do Agent. Só importa se o processo do Agent for comprometido; não dá root nem acesso a arquivos. | O polkit não informa à regra qual conta está sendo alterada. |
| Compose só para desenvolvimento | `docker-compose.yml` sobe o backend em `development`: rotas do client simulado e identidades de demonstração ficam ativas. | É o que a demonstração usa. Não expor essa API na internet. |
| Limite de tentativas em memória e por IP | O contador zera ao reiniciar e não vale entre instâncias; muitos IPs escapam do limite; atrás de proxy sem `trust proxy`, conta o IP do proxy. | Contador compartilhado (Redis ou banco) é desproporcional ao projeto. |
| Cadastro revela e-mail existente | `register` e troca de e-mail respondem `409` para e-mail já usado. | Escondê-lo exige confirmação por e-mail. Atenuado pelo limite de tentativas. |
| Mobile em `http` na rede local | No modo LAN do Expo o app fala com a API sem TLS; na mesma Wi-Fi é possível ler senha e token. | O Expo Go no Android não confia em CA instalada pelo usuário; HTTPS no mobile depende de certificado público (hospedagem ou túnel). |
| Sem `helmet` e senha só com tamanho mínimo | Sem cabeçalhos de segurança para navegador; senhas como `12345678` são aceitas. | A API só serve JSON ao app; o limite de tentativas freia adivinhação. |
| Phishing de QR | Alguém pode induzir o responsável a ler o QR de outro computador. | Mitigado pela tela de confirmação com nome e conta do computador. |
