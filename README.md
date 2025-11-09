# 📈 Calculadora de Investimentos

Essa é uma aplicação web construída em **React** que oferece algumas **calculadoras financeiras**.  
Ela foi projetada para ajudar usuários a analisar e comparar o que aconteceria em diferentes cenários de investimento, com foco especial em opções do mercado brasileiro como **FIIs (Fundos de Investimento Imobiliário)**, **CDBs** e **LCIs**.

Essa aplicação utiliza um **frontend em React** construído com **Vite** e usa **Tailwind CSS** para a estilização.  
Os dados para os módulos de FIIs são buscados de um **backend Supabase**

🔗 **Demo ao Vivo:** [https://mateusb12.github.io/investments-calculator](https://mateusb12.github.io/investments-calculator)

---

## ✨ Funcionalidades

- **Verificador Histórico de FIIs:**  
  Permite escolher um ticker de Fundo de Investimento Imobiliário (FII) brasileiro e visualizar seu histórico de pagamentos de dividendos e preços das cotas

- **Simulador de FIIs:**  
  Uma ferramenta de simulação que permite escolher o valor de um investimento inicial, depósito mensal (aportes) e o período de tempo.  
  Esse simulador testa a estratégia no ambiente dos dados históricos do FII, mostrando a diferença entre as estratégias **reinvestir** os dividendos ou **sacar o saldo**.

- **Comparação de Rentabilidade (LCI/LCA vs. CDB):**  
  Compara os retornos líquidos de um investimento isento de impostos (LCI/LCA) com um investimento tributável (CDB), levando em conta a **tabela regressiva do IR**.

- **Calculadora de Impacto Reverso:**  
  Determina **quantos meses** levaria para que a diferença líquida entre dois investimentos (ex: LCI a 95% do CDI vs. CDB a 110% do CDI) atingisse um **valor alvo** específico

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React** – Interface do usuário
- **Vite** – Build e servidor de desenvolvimento
- **Tailwind CSS** – Estilização e UI
- **Recharts** – Gráficos interativos no Simulador de FIIs

### Backend & Dados
- **Supabase** – Armazena e serve os dados históricos da B3
- **b3service.js** – Gerencia todas as chamadas de API para o Supabase

---

## 🚀 Executando o Projeto Localmente

### 1️⃣ Pré-requisitos
- Node.js (v18 ou superior)
- npm ou yarn
- Projeto Supabase configurado

---

### 2️⃣ Clonar e Instalar

```bash
git clone https://github.com/mateusb12/investments-calculator.git
cd investments-calculator
npm install
