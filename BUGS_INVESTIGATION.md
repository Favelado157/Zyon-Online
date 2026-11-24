# Investigação de Bugs - Legend Online Ultra

**Data:** 2026-11-16 a 2026-11-17

---

## Bug 1: Botão de Elevar Prédios Não Aparece ✅ CORRIGIDO

### Análise Concluída

**Causa Provável Identificada:**

No código `upgradeBuildingOrTech` em `progress.ts`:

1. **`NextGradeTemplateId` vazio** - O prédio pode não ter um próximo nível definido
2. **`TemplateId inválido`** - `t.get('BuildingTempInfos', b.template_id)` retorna undefined
3. **SQL pode estar retornando vazio**: Se o `NextGradeTemplateId` está vazio ou 0, a função retorna cedo

### Correções Implementadas (2026-11-17)

**Arquivo:** `apps/server/src/game/handlers/castle.ts`

**Mods feitos:**
1. Adicionado logging detalhado em `upgradeBuildingOrTech`:
   - Log de tentativa de upgrade
   - Log de criação de novo prédio
   - Log de prédio já existente
   - Log de prédio não encontrado
   - Log de template atual não encontrado
   - Log de template de upgrade não encontrado

2. **Melhoria de fluxo:**
   - Verificação explícita de `curTpl` antes de usar
   - Verificação explícita de `nextTplId` antes de buscar próximo template
   - Verificação explícita de `nextTpl` antes de continuar

3. **Código corrigido:**
```typescript
// Novos logs adicionados
s.log.debug({ sonType, buildingId }, 'tentativa de upgrade de prédio');
s.log.warn({ sonType }, 'prédio nao encontrado nos templates');
s.log.warn({ sonType, buildingId }, 'prédio nao encontrado após tentativa de criacao');
s.log.warn({ templateId: b.template_id }, 'template atual do prédio nao encontrado');
s.log.warn({ nextTplId }, 'template de upgrade nao encontrado');
```

3. **Verificação explícita:**
   - Removido retorno silencioso
   - Adicionado logs para cada ponto de falha

---

## Bug 2: Barra de Tarefas Tremendo

### Causa Provável

Loop de atualização de missões ou mensagem de XP

### Arquivos para Verificar

- `apps/server/src/game/progress.ts` - funções `addExp` e `advanceQuestCondition`
- `apps/server/src/game/session.ts` - gerenciamento de conexões WebSocket

---

## Bug 3: Quest de Recrutar Soldados Não Dispara

### Código Existente

- `handlers/castle.ts:70-105` - função `recruitPawn` já chama:
  ```typescript
  advanceQuestCondition(s.ctx.sql, t, snap, '3', tpl.MasterType || (reqSonType - 100), count, 'add');
  ```

### Possíveis Causas

1. **Missão não existe ou está com `IsAuto=false`**: A missão precisa ser aceita
2. **Pré-requisitos não atendidos**: `PreQuestId`, `NeedMinLevel`, `IsRepeat`
3. **Condição não está sendo atualizada corretamente**: Verificar `QuestCondictionInfos` com `CondictionType = '3'`

---

## Bug 4: Entry na Campanha Single Player Não Dispara

### Código Existente

- `handlers/campaign.ts:64-80` - função `enterTutorial`
- `handlers/campaign.ts:77-80` - função `training` verifica `newbie_process < TUTORIAL_DONE`

### Possíveis Causas

1. **Tutorial não concluído**: `newbie_process` não chegou a 19000
2. **Cliente não chama o handler 5127**: Conectar com o console do jogo para verificar
3. **Mapa tutorial não configurado corretamente**

---

## Bug 5: Labirinto Não Disparável Na Primeira Vez

### Código Existente

- `handlers/campaign.ts:95-110` - função `enterMazeFloor`
- `handlers/campaign.ts:112-138` - função `mazeArrive`

### Possíveis Causas

1. **Estado do labirinto não inicializado**: `maze_floor` pode ser 0 ou nulo
2. **Item de entrada faltando**: `Crypt Key` (item 2100009) necessário
3. **Dia do jogo não atualizou**: Reset diário pode estar travado

---

## Próximos Passos

1. **Teste com console aberto**: Verificar erros no console do navegador
2. **Logs detalhados**: Executar com logs ativados e observar saída
3. **Verificar templates**: Checar `BuildingTempInfos`, `QuestTemps`, `QuestCondictionInfos`
4. **Testar com conta QA existente**: Usar a conta criada durante o deploy