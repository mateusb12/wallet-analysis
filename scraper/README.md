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
