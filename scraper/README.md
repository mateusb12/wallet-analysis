# Scraper local

Este diretório contém o agente local que abre o navegador visível no desktop.

No ambiente local, o agente é iniciado automaticamente pelo serviço do usuário:

```bash
systemctl --user status wallet-analysis-scraper.service
```

O fluxo normal é:

```bash
docker compose up -d
```

O backend Docker chama o agente local quando a job é executada. Ao parar o stack:

```bash
docker compose down
```

o backend solicita que o agente feche o navegador.

Se o agente estiver parado, iniciar novamente com:

```bash
systemctl --user restart wallet-analysis-scraper.service
```

O serviço está definido em `wallet-analysis-scraper.service` e usa `agent.js`.

O login da B3 pode ser automatizado com `B3_CPF` e `B3_PASSWORD` no `.env` da
raiz do projeto. Os valores nunca são escritos nos logs. Se a B3 solicitar
CAPTCHA ou autenticação adicional, a janela permanece aberta para conclusão
manual.
