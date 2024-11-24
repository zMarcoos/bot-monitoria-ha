# 📚 Bot Monitoria HA

Um bot Discord projetado para facilitar a gestão de atividades acadêmicas, promover o engajamento dos alunos e proporcionar uma experiência dinâmica e lúdica na disciplina.

---

## 🚀 Objetivos do Projeto

- **Organização**: Simplificar a administração de atividades por professores e monitores.
- **Engajamento**: Estimular os alunos a participarem com um sistema gamificado.
- **Acessibilidade**: Centralizar informações e interações diretamente no servidor do Discord.
- **Monitoramento**: Garantir estabilidade e monitorar erros em tempo real.

---

## 🔥 Funcionalidades Principais

### 🎮 Sistema de Comandos
- **Generalização de Comandos**: Uma interface unificada que centraliza a execução e depuração, facilitando testes e manutenção.
- **Atividades**:
  - Consultar atividades disponíveis, com todas as informações relevantes.
  - Cadastrar atividades (para docentes e monitores).
  - Submeter atividades para correção, com feedback do professor e comentários para ajustes.
- **Ranking**:
  - Consultar o ranking dos alunos, promovendo uma competição saudável.
  - Estimular engajamento e participação ativa.
- **Usuário**:
  - Visualizar o personagem associado (Finn ou Jake), que ganha estrelas de acordo com o progresso.
  - Conquistar o título de mestre da disciplina com uma estrela gigante ao completar todas as atividades.

### 🔧 Monitoramento e Tratamento de Erros
- **Integração com WhatsApp**:
  - Relatórios em tempo real sobre erros, garantindo que problemas sejam rapidamente resolvidos.
- **Tratamento de Erros Robusto**:
  - Logs detalhados para identificar e solucionar falhas.

### 📈 Sistema Gamificado
- **XP e Níveis**:
  - Um sistema de cargos baseado no progresso, recompensando os alunos mais engajados.
  - Feedback imediato e reconhecimento direto no Discord.
- **Personagens Lúdicos**:
  - Finn e Jake representam o progresso dos alunos de forma visual e divertida.

### 🌟 Mensagens e Relatórios
- **Mensagens Motivacionais Diárias**:
  - Mensagens automáticas para inspirar os alunos e manter a moral alta.
- **Relatórios Semanais**:
  - Um resumo personalizado do progresso dos alunos, promovendo reflexão e ajustes no aprendizado.

---

## 🛠️ Tecnologias Utilizadas

- **Node.js**: Base para o desenvolvimento do bot.
- **Discord.js**: Biblioteca para integração com o Discord.
- **Twilio**: Integração com o WhatsApp para relatórios em tempo real.
- **dotenv**: Gerenciamento de variáveis de ambiente.
- **node-cron**: Tarefas agendadas, como mensagens diárias e relatórios semanais.

---

## 🏗️ Arquitetura do Sistema

O sistema é modular e organizado para facilitar manutenção e extensibilidade. Abaixo estão os principais componentes:

- **Comandos**: Organização dos comandos em uma interface unificada.
- **Gerenciador de Erros**: Captura e tratamento centralizado de erros.
- **Gamificação**: Sistema de XP, cargos, e personalização de personagens.
- **Mensagens Automatizadas**: Integração com cron jobs para mensagens e relatórios.

---

## 🧩 Instalação e Configuração

### Pré-requisitos
- Node.js (>= 16.x)
- Conta no Discord para criar e configurar o bot.
- Conta no Twilio para integração com WhatsApp.

### Instalação
1. Clone o repositório:
   ```bash
   git clone https://github.com/zMarcoos/bot-monitoria-ha.git
   cd bot-monitoria-ha
   ```
2. Instale as dependências:
   ```bash
    npm install
    ```
3. Configure as variáveis de ambiente
- Crie um arquivo `.env` com os seguintes valores:
    ```env
    DISCORD_TOKEN=token-do-bot
    CLIENT_ID=id-do-bot
    GUILD_ID=id-do-servidor
    ```

4. Inicie o bot:
    ```bash
    node src/index.js
    ```

## 🔮 Melhorias Futuras
- 📌 **Refinar a responsabilidade de cada função**:
  - Aumentar a modularidade e simplificar a manutenção.
- 🎨 **Melhorar o design das embeds**:
  - Aprimorar a experiência do usuário com um design mais atraente.
- 📨 **Aposentar as DMs**:
  - Centralizar todas as interações no servidor, evitando mensagens diretas.
- 📊 **Ajustar o rank e colocar o critério de tempo**:
  - Incluir o tempo como critério para evitar que alunos acumulem pontos sem participar ativamente.