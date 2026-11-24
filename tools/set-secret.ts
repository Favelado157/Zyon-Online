import { connect } from '@lou/db';
import { SecretStore } from '../apps/server/src/services/secrets.ts';

const key = process.argv[2];
const value = process.env.SECRET_VALUE;
if (!key || !value) {
  console.error('uso: SECRET_VALUE=... node --env-file=.env tools/set-secret.ts <chave>');
  process.exit(1);
}
const sql = connect();
try {
  await new SecretStore(sql, process.env.APP_SECRET ?? '').set(key, value, null);
  console.log(`${key} gravado (final ${value.slice(-4)})`);
} finally {
  await sql.end();
}
