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

Status: parcialmente concluída. A centralização foi implementada, mas os testes de contrato e a validação funcional ainda estão pendentes. Auth e Storage continuam pendentes na etapa 3.

Criar repositórios orientados ao domínio:

- [x] `MarketDataRepository` para sincronização e cache, inicialmente com adapter Supabase
- [x] `AnalysisRepository` para leituras de análise, inicialmente com adapter Supabase
- [x] `WalletRepository` (CRUD, importação, dashboard e histórico)
- [x] `UserRepository`
- [x] Repositório para IPCA, CDI, IFIX e IBOV, dentro do `MarketDataRepository`
- [x] Repositório para cache de classificação, dentro do `MarketDataRepository`

Depois:

- [x] Remover `supabase.table(...)` dos routers de dados.
- [x] Remover `db.query(...)` dos routers de dados.
- [x] Fazer os routers de dados chamarem repositórios.
- [ ] Validar o comportamento atual sem trocar o banco.
- [ ] Adicionar testes dos repositórios.

Critério parcial: os routers de dados não conhecem Supabase ou detalhes de SQLAlchemy. Auth e Storage ficam isolados na etapa 3.

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

- Status: parcialmente concluída. Os dados de referência já passam pelo backend; B3, operações de usuário/carteira, autenticação e Storage ainda estão pendentes.

- [x] Criar endpoints backend para IPCA, IFIX, IBOV e CDI.
- [x] Migrar `ipcaService.js`.
- [x] Migrar `ifixService.js`.
- [x] Migrar `ibovService.js`.
- [x] Migrar `cdiService.js`.
- [ ] Migrar `b3service.js`.
- [ ] Migrar operações de carteira e usuário.
- [ ] Remover consultas diretas às tabelas do Supabase dos services restantes.
- [ ] Manter Supabase apenas onde ele ainda for explicitamente necessário.

Pendências para concluir a etapa:

- Migrar o B3 e revisar os fluxos de carteira/usuário.
- Validar os contratos HTTP e as respostas no frontend com o ambiente completo instalado.
- Confirmar que os únicos usos restantes do Supabase são autenticação e Storage, tratados na etapa 3.

Critério de conclusão: o frontend fala com a aplicação, não diretamente com o banco.

## 3. Separar autenticação e storage

### Autenticação

- [ ] Criar uma interface de autenticação.
- [ ] Criar adapter Supabase Auth.
- [ ] Definir como será o adapter local.
- [ ] Evitar que os routers chamem `supabase.auth` diretamente.
- [ ] Padronizar a obtenção do usuário atual.

### Storage

- [ ] Isolar upload de avatar atrás de uma interface.
- [ ] Manter Supabase Storage inicialmente, se for conveniente.
- [ ] Deixar possível trocar depois por filesystem local ou outro storage.

Critério de conclusão: trocar o banco não exige reescrever os routers.

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
