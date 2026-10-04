# Plano de desacoplamento da persistência

## Objetivo

Deixar a aplicação agnóstica ao provedor de persistência, permitindo usar SQLite localmente e PostgreSQL/Supabase no futuro, sem espalhar detalhes do banco pela lógica da aplicação.

O objetivo não é remover o Supabase imediatamente. A primeira etapa é criar uma seam limpa mantendo o comportamento atual.

## Princípios

- Regras de negócio não conhecem Supabase, SQLite ou SQLAlchemy.
- Routers não executam consultas diretamente.
- O frontend conversa com o backend, não diretamente com as tabelas.
- Autenticação, persistência e storage são responsabilidades separadas.
- A abstração deve ser pequena e orientada ao domínio.
- O adapter atual do Supabase deve continuar funcionando durante a migração.

## Arquitetura desejada

```text
frontend
   ↓
routers
   ↓
serviços da aplicação
   ↓
repositórios / interfaces
   ↓
adapters de persistência
   ├── SQLite
   └── PostgreSQL/Supabase
```

Autenticação e storage terão seams próprias:

```text
autenticação
   ├── Supabase Auth
   └── Auth local

storage
   ├── Supabase Storage
   └── filesystem local ou outro provider
```

## 0. Registrar o estado atual

- [x] Mapear usos de `supabase.table(...)` no backend.
- [x] Mapear usos de Supabase no frontend.
- [x] Identificar o que já usa SQLAlchemy.
- [x] Separar dados, autenticação e storage como problemas diferentes.
- [x] Definir os contratos iniciais dos repositórios.

Critério de conclusão: saber exatamente quais módulos precisam de persistência e quais dependem de autenticação.

## 1. Centralizar a persistência do backend

Status: parcialmente concluída. A centralização dos routers foi implementada, mas os testes de contrato e a validação funcional ainda estão pendentes. Auth e Storage não fazem parte desta etapa.

Criar repositórios orientados ao domínio:

- [x] `MarketDataRepository` para sincronização e cache, inicialmente com adapter Supabase
- [x] `AnalysisRepository` para leituras de análise, inicialmente com adapter Supabase
- [x] `WalletRepository` (CRUD, importação, dashboard e histórico)
- [x] `UserRepository`
- [x] `ReferenceDataRepository` para IPCA, CDI, IFIX e IBOV
- [x] Repositório para cache de classificação, dentro do `MarketDataRepository`

Depois:

- [x] Remover `supabase.table(...)` dos routers de dados.
- [x] Remover `db.query(...)` dos routers de dados.
- [x] Fazer os routers de dados chamarem repositórios.
- [ ] Validar o comportamento atual sem trocar o banco.
- [ ] Adicionar testes dos repositórios.

Critério parcial: os routers de dados não conhecem Supabase ou detalhes de SQLAlchemy. Auth e Storage permanecem em seams próprias na etapa 3.

Resultado atual:

- `users` usa `UserRepository`.
- Operações CRUD/importação da carteira usam `WalletRepository`.
- Dashboard e histórico da carteira usam `WalletRepository`.
- Sincronizações e cache de mercado usam `MarketDataRepository`.
- Análises usam `AnalysisRepository`.
- Os adapters atuais ainda são SQLAlchemy para carteira/usuários e Supabase para mercado/análise.

Pendências para concluir a etapa:

- Testar os contratos com doubles/fakes dos adapters.
- Validar as rotas com o ambiente Python completo instalado.
- Comparar respostas antes/depois da migração.

## 2. Remover acesso direto do frontend ao Supabase

Status: parcialmente concluída. Os dados de referência, B3 e os fluxos principais de carteira/perfil já passam pelo backend; falta apenas validação completa dos contratos. Autenticação e Storage agora estão concentrados em adapters próprios.

- [x] Criar endpoints backend para IPCA, IFIX, IBOV e CDI.
- [x] Migrar `ipcaService.js`.
- [x] Migrar `ifixService.js`.
- [x] Migrar `ibovService.js`.
- [x] Migrar `cdiService.js`.
- [x] Manter as operações de dados de `walletDataService.js` atrás do backend.
- [x] Manter leitura/edição do perfil atrás do backend.
- [x] Migrar `b3service.js`.
- [x] Remover consultas diretas às tabelas do Supabase dos services restantes.
- [x] Remover dependências de autenticação do Supabase dos services de dados, concentrando-as em `authClient.js`.

Pendências para concluir a etapa:

- Validar os contratos HTTP e as respostas no frontend com o ambiente completo instalado.
- Confirmar que os únicos usos restantes do Supabase no frontend são autenticação e Storage.

Critério de conclusão: o frontend fala com a aplicação, não diretamente com o banco.

## 3. Separar autenticação e storage

Status: parcialmente concluída. As seams e os adapters Supabase e locais foram criados; ainda falta validar o modo local e concluir a portabilidade do modelo de dados.

### Autenticação

- [x] Criar uma interface de autenticação.
- [x] Criar adapter Supabase Auth.
- [x] Definir como será o adapter local.
- [x] Evitar que os routers chamem `supabase.auth` diretamente.
- [x] Padronizar a obtenção do usuário atual.

### Storage

- [x] Isolar upload de avatar atrás de uma interface.
- [x] Manter Supabase Storage inicialmente, se for conveniente.
- [x] Deixar possível trocar depois por filesystem local ou outro storage.

Critério de conclusão: trocar o provider de autenticação ou Storage não exige reescrever os routers nem os consumidores do frontend.

Implementação atual:

- `AUTH_PROVIDER=local` ativa autenticação local no backend.
- `VITE_AUTH_PROVIDER=local` ativa a sessão local no frontend.
- `LOCAL_AUTH_STORE` define o arquivo de usuários locais.
- `AUTH_SECRET_KEY` assina os tokens locais e deve ser obrigatória em produção.
- `LOCAL_STORAGE_PATH` define onde os avatares locais são gravados.
- O login Google continua disponível apenas com o adapter Supabase.
- O modo local ainda depende da etapa 4 para tornar o banco e os modelos de usuário compatíveis com SQLite.

## 4. Tornar o modelo de dados portátil

- [ ] Remover dependência direta de `auth.users` dos modelos compartilhados.
- [ ] Revisar uso de UUID.
- [ ] Revisar `Identity`, `Numeric`, `JSON` e timestamps.
- [ ] Remover migrations específicas de PostgreSQL do caminho comum.
- [ ] Criar migrations compatíveis com SQLite e PostgreSQL.
- [ ] Definir constraints e índices que funcionam nos dois bancos.
- [ ] Revisar views usadas atualmente pelo frontend.

Critério de conclusão: o mesmo modelo lógico pode ser criado em SQLite e PostgreSQL.

## 5. Implementar SQLite

- [ ] Configurar `DATABASE_URL=sqlite:///...`.
- [ ] Configurar engine SQLite corretamente.
- [ ] Criar banco local vazio via Alembic.
- [ ] Rodar os testes contra SQLite.
- [ ] Importar os dados necessários do Supabase.
- [ ] Testar sincronização de B3, CDI, IPCA, IFIX e IBOV.
- [ ] Testar carteira e perfil de usuário.
- [ ] Testar reinício da aplicação preservando os dados.

Critério de conclusão: a aplicação funciona localmente sem depender do Supabase para dados.

## 6. Validar o modo Supabase/PostgreSQL

- [ ] Rodar a mesma suíte contra PostgreSQL/Supabase.
- [ ] Validar autenticação Supabase.
- [ ] Validar constraints e índices.
- [ ] Validar volume de dados histórico.
- [ ] Validar permissões e segurança.
- [ ] Alternar o modo apenas por configuração.

Critério de conclusão: SQLite e Supabase são adapters intercambiáveis para a mesma aplicação.

## 7. Documentar operação

- [ ] Documentar configuração local.
- [ ] Documentar configuração hospedada.
- [ ] Documentar importação e exportação de dados.
- [ ] Documentar limitações do SQLite.
- [ ] Documentar que SQLite não deve ser usado no Fly.io sem volume persistente.
- [ ] Adicionar comandos de setup e migração ao README.

## Primeira entrega recomendada

```text
repositórios
→ migrar wallet
→ migrar users
→ migrar market_data
→ migrar analysis
→ retirar acesso direto do frontend
```

Autenticação local e troca efetiva para SQLite ficam para uma segunda etapa. Primeiro criamos a seam mantendo o Supabase funcionando; depois adicionamos o adapter SQLite com risco menor.

## Riscos e decisões importantes

- SQLite é adequado para desenvolvimento e uso pessoal/single-user.
- O deploy atual no Fly.io não possui volume persistente configurado; um arquivo SQLite pode ser perdido em redeploy ou recriação da máquina.
- Supabase não é apenas banco: também fornece Auth, Storage, RLS e APIs.
- Não devemos criar um `DatabaseService` genérico com dezenas de métodos. As interfaces devem representar operações do domínio.
- Cada etapa deve preservar o comportamento existente antes de avançar para a próxima.
