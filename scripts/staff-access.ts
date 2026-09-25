// Team access from the command line, with the service role key: for the
// first owner (nobody can issue access in the panel yet) and as a fallback.
// Prints the temporary password once; it is not saved anywhere.
//
//   node --env-file=.env.local --import tsx scripts/staff-access.ts criar --email pessoa@empresa.com --nome "Nome Sobrenome" --papel responsavel
//   node --env-file=.env.local --import tsx scripts/staff-access.ts nova-senha --email pessoa@empresa.com
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, for example
// from `vercel env pull .env.local` (ignored by Git; delete it afterwards).
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { HttpError } from '../server/http.js';
import { createAccess, findUser, resetAccess, TEMPORARY_PASSWORD_HOURS, type Role } from '../server/staff.js';

const usage = [
  'Uso:',
  '  staff-access.ts criar --email <e-mail> --nome "<nome>" --papel responsavel|editor',
  '  staff-access.ts nova-senha --email <e-mail>',
].join('\n');
const messages: Record<string, string> = {
  already_member: 'Essa pessoa já faz parte da equipe. Use "nova-senha".',
  not_found: 'Essa pessoa não faz parte da equipe.',
  auth_create_failed: 'O Supabase Auth recusou a criação do usuário.',
  auth_update_failed: 'O Supabase Auth recusou a atualização. O acesso continua bloqueado; rode o comando de novo.',
};

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

const { positionals, values } = parseArgs({ allowPositionals: true, options: { email: { type: 'string' }, nome: { type: 'string' }, papel: { type: 'string' } } });
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.grupovelmont.com').trim().replace(/\/$/, '');
if (!url || !key) stop('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (por exemplo: vercel env pull .env.local).');
const email = (values.email || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) stop(usage);
const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

async function run() {
  const [command] = positionals;
  if (command === 'criar') {
    const roles: Record<string, Role> = { responsavel: 'owner', editor: 'editor' };
    const role = roles[values.papel || ''];
    const name = (values.nome || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!role || !name) stop(usage);
    return createAccess(service, null, { email, name, role });
  }
  if (command === 'nova-senha') {
    const found = await findUser(service, email);
    if (!found?.is_member) stop(messages.not_found);
    return resetAccess(service, null, found.user_id);
  }
  return stop(usage);
}

try {
  const access = await run();
  const until = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(access.expiresAt));
  console.log(
    [
      '',
      `Endereço:          ${site}/admin`,
      `E-mail:            ${email}`,
      `Senha temporária:  ${access.password}`,
      `Válida até:        ${until} (${TEMPORARY_PASSWORD_HOURS} h, horário de Brasília)`,
      '',
      'Envie diretamente para a pessoa, por um canal privado. A senha não será mostrada de novo.',
      'No primeiro acesso ela cadastra o aplicativo autenticador e cria a própria senha.',
      '',
    ].join('\n'),
  );
} catch (error) {
  stop(error instanceof HttpError ? messages[error.code] || `Falha: ${error.code}` : 'Falha inesperada. Nada foi liberado.');
}
