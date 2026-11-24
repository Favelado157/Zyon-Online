# Roadmap de Desenvolvimento - Legend Online Ultra

**Criado:** 2026-11-16  
**Estado Atual:** Reorganização concluída, infraestrutura funcional, missões parcialmente implementadas

---

## 📊 Status Geral

### ✅ Concluído/Validado
- [x] Estrutura do projeto (TypeScript/Node.js/Fastify)
- [x] Sistema de templates carregado (QuestTemps, QuestCondictionInfos, QuestGoods, BuildingTempInfos, etc.)
- [x] Sistema de missões básico (aceite e conclusão)
- [x] Tipos de condições implementados:
  - Tipo 1: Nível do jogador
  - Tipo 2: Upgrade do Town Hall (prédio)
  - Tipo 3: Recrutar tropas
  - Tipo 10: Upgrade de tropa
  - Tipo 14: Conquistar castelo (robot)
  - Tipo 21: Fazer amizade
  - Tipo 22: Criar/juntar guilda
  - Tipo 23: Passo do tutorial
  - Tipo 34: Presente VIP
  - Tipo 38: Labirinto de gêmeos
  - Tipo 85: Falar com NPC

- [x] Sistema de batalha (campaign.ts)
- [x] Sistema de arena/coliseu (arena.ts)
- [x] Sistema de castle/hampton (castle.ts)
- [x] Sistema de farm (farm.ts)
- [x] Sistema de forja (forge.ts)

---

## 🎯 Prioridade 1 - Q1 2026

### Sistema de Condições de Missões (MISSÕES)

| Missão | Tipo | Status | Responsável | Data Início | Data Fim |
|--------|------|--------|-------------|-------------|----------|
| Coletar itens (27) | Bolsa - items | ✅ Implementado | Sistema genérico | 2026-11-16 | 2026-11-16 |
| Matar soldados (25) | Batalha - soldados | ✅ **Implementado** | `campaign.ts` linhas 407-420 | 2026-11-16 | 2026-11-16 |
| Derrotar chefe (26) | Batalha - chefes | ✅ Implementado | `handlers/campaign.ts:402-406` | 2026-11-16 | 2026-11-16 |
| Amethyst Rush (86) | Mina | ❌ Não iniciado | - | - | - |
| Devoção (63) | Evento | ❌ Não iniciado | - | - | - |

### Missões de Batalha
| Missão | Tipo | Status | Detalhes |
|--------|------|--------|----------|
| Missão 60 "OccupY Gold Mines" | Tipo 7 | ❌ Não iniciado | Precisa de handler para ocupar minas |
| Missão 100 "Plunder a City" | Tipo 8 | ❌ Não iniciado | Precisa de sistema PvP castelo |
| Missão 765 "Plunder Hostile City" | Tipo 8 | ❌ Não iniciado | Versão diária |

### Missões de Construção
| Missão | Tipo | Status | Detalhes |
|--------|------|--------|----------|
| Missão 111 "Speed Up Building" | Tipo 12 | ❌ Não iniciado | Acelerar construção |
| Missão 121 "Enchant Weapon" | Tipo 17 | ❌ Não iniciado | Refino de equipamento |
| Missão 281 "Socket Gem" | Tipo 18 | ❌ Não iniciado | Inserir pedra |

---

## 🎯 Prioridade 2 - Q2 2026

### Missões de Forja/Refino
- [ ] Missão 311 "Synthesize a Gem" (Tipo 19)
- [ ] Missão 768 "Recycle Equipment" (Tipo 46)
- [ ] Missão 769 "Refine Equipment" (Tipo 47)

### Missões de Itens/Coleção
- [ ] Missão 90 "Collect Worg Teeth" (Tipo 27) - itens de coleta
- [ ] Missão 102 "Collect Lumber" (Tipo 32)
- [ ] Missão 313 "Complete Solo Dungeon" (Tipo 31)

### Missões de Eventos
- [ ] Amethyst Rush (Tipo 86)
- [ ] Devoção diária (Tipo 63)
- [ ] Roda do destino (Tipo 81)

---

## 🎯 Prioridade 3 - Q3-Q4 2026

### Sistema de Battleground (PvP)
- [ ] Missão 44 "Participate in a Battleground" (Tipo 44)
- [ ] Missão 45 "Battleground Kills" (Tipo 45)
- [ ] Missão 50 "Battleground Victory" (Tipo 50)

### Missões de Mundo
- [ ] Missão 3 "Enter Sky Trail" (Tipo 81)
- [ ] Missão 932 "Win Sky Trail Battle" (Tipo 93)

---

## 🏗️ Tarefas Técnicas

### Infraestrutura
- [ ] Melhorar logs de auditoria
- [ ] Implementar cache de templates
- [ ] Otimizar queries de quest progress

### Qualidade
- [ ] Testes unitários para novas funcionalidades
- [ ] Cobertura de testes > 80%

---

## 📅 Próximos 30 dias

### 2026-11-16 - Início da implementação

#### ✅ Implementado até agora:

1. **Roadmap de desenvolvimento criado** - Arquivo `RUNWAY_DESENVOLVIMENTO.md`
   - Documentação completa de status atual
   - Prioridades definidas por trimestre
   - Tarefas técnicas listadas

2. **Análise de código concluída:**
   - `handlers/quests.ts` - Sistema de aceitação e conclusão de missões
   - `handlers/campaign.ts` - Sistema de masmorras e batalhas
   - `handlers/arena.ts` - Sistema de coliseu
   - `handlers/castle.ts` - Sistema de castelo
   - `handlers/forge.ts` - Sistema de forja
   - `progress.ts` - Função `advanceQuestCondition` para atualizar progresso
   - `inventory.ts` - Sistema de itens e bolsa

3. **Handlers criados:**
   - `handlers/quest_battle.ts` - Novo handler para missões de batalha

#### ✅ Implementação concluída:

1. **Missões de chefes (Tipo 26)** - JÁ IMPLEMENTADO
   - Localizado em `handlers/campaign.ts` (linhas 402-406)
   - Função `singleCampaignFight` já atualiza progresso de missões quando chefes são derrotados
   - Usa `advanceQuestCondition(s.ctx.sql, t, snap, '26', Number(fh.temp_id), 1, 'add')`

2. **Missões de soldados (Tipo 25)** - **ACABOU DE IMPLEMENTAR**
   - Modificado `handlers/campaign.ts` (linhas 407-420)
   - Conta soldados derrotados por `temp_id` de `card.Soldiers`
   - Atualiza progresso com `advanceQuestCondition(s.ctx.sql, t, snap, '25', sId, 1, 'add')`

3. **Missões de missão 14 (conquistar masmorra)** - JÁ IMPLEMENTADO
   - Também em `singleCampaignFight` (linha 410)
   - Atualiza quando a última etapa de uma masmorra é concluída

#### ⏳ Pendentes - Próximos passos:

1. **Implementar condições de missões de coleta (Tipo 27/28/32/49)**
   - Verificar progresso de itens na bolsa
   - Atualizar quando o jogador coleta itens

2. **Implementar missões de construção/aceleração (Tipos 12, 14)**
   - Acelerar construção
   - Ocupar minas de ouro

---

*Status atualizado: 2026-11-16*

---

## 🔧 Tecnologias e Dependências

- **Node.js:** 20.x
- **TypeScript:** 5.x
- **Fastify:** 5.x
- **SQLite:** Para dados persistentes
- **WebSocket:** Comunicação cliente-servidor

---

## 🤝 Contribuições

Para contribuir:
1. Verifique o status da tarefa no roadmap
2. Crie um branch com o nome da tarefa
3. Implemente as mudanças com testes
4. Abra um Pull Request para revisão

---

*Este roadmap é dinâmico e será atualizado conforme o progresso do desenvolvimento.*