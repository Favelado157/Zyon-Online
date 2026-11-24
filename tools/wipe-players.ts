// Ambiente de DESENVOLVIMENTO: apaga TODAS as contas de jogador, personagens e guildas (definitivo).
// Mantém catálogo, servidores, configurações e usuários do painel admin (core.admin_users).
// Uso: node --env-file=.env tools/wipe-players.ts --yes
import postgres from 'postgres';

if (!process.argv.includes('--yes')) {
  console.error('Operação definitiva. Rode com --yes para confirmar.');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!);
const before = await sql`SELECT (SELECT count(*) FROM core.accounts)::int contas, (SELECT count(*) FROM game.characters)::int personagens, (SELECT count(*) FROM game.guilds)::int guildas`;
await sql.begin(async tx => {
  await tx`DELETE FROM game.guild_members`;
  await tx`UPDATE game.characters SET guild_id = NULL WHERE guild_id IS NOT NULL`;
  await tx`DELETE FROM game.guilds`;
  // Referências sem cascata (pertencem só a contas/personagens de jogador).
  await tx`DELETE FROM liveops.gift_code_redemptions`;
  await tx`DELETE FROM economy.first_purchases`;
  await tx`DELETE FROM economy.orders`;
  await tx`DELETE FROM security.anticheat_flags WHERE account_id IS NOT NULL OR character_id IS NOT NULL`;
  await tx`DELETE FROM security.sanctions WHERE account_id IS NOT NULL OR character_id IS NOT NULL`;
  await tx`DELETE FROM audit.login_history WHERE account_id IS NOT NULL`;
  await tx`DELETE FROM game.characters`; // cascata: heróis, itens, quests, carteiras, prédios...
  await tx`DELETE FROM core.accounts`;   // cascata: sessões, play_tickets; tickets/admin_users ficam sem vínculo
});
const after = await sql`SELECT (SELECT count(*) FROM core.accounts)::int contas, (SELECT count(*) FROM game.characters)::int personagens, (SELECT count(*) FROM game.guilds)::int guildas, (SELECT count(*) FROM core.admin_users)::int admins`;
console.log('antes', before[0], 'depois', after[0]);
await sql.end();
