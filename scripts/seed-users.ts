/**
 * Seeds users directly via DATABASE_URL (PostgreSQL).
 * Inserts the UUID-format identity row that newer Supabase versions require.
 *   npx tsx scripts/seed-users.ts
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

function parseDbUrl(url: string) {
  const withoutScheme = url.replace(/^[^:]+:\/\//, '');
  const atIdx = withoutScheme.lastIndexOf('@');
  const userPass = withoutScheme.slice(0, atIdx);
  const hostPart = withoutScheme.slice(atIdx + 1);
  const colonIdx = userPass.indexOf(':');
  const user     = userPass.slice(0, colonIdx);
  const password = userPass.slice(colonIdx + 1);
  const [hostPort, database] = hostPart.split('/');
  const [host, port] = hostPort.split(':');
  return { user, password, host, port: parseInt(port ?? '5432'), database };
}

const pool = new Pool({
  ...parseDbUrl(process.env.DATABASE_URL!),
  ssl: { rejectUnauthorized: false },
});

// Credentials are read from .env — never hardcode them here.
// Add to .env: SEED_USER_EMAIL and SEED_USER_PASSWORD
const email    = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;
if (!email || !password) {
  console.error('Missing SEED_USER_EMAIL or SEED_USER_PASSWORD in .env');
  process.exit(1);
}
const USERS = [{ email, password }];

async function upsertUser(email: string, password: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query<{ id: string }>(
      'SELECT id FROM auth.users WHERE email = $1', [email]
    );

    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id;
      await client.query(`
        UPDATE auth.users
        SET encrypted_password = crypt($2, gen_salt('bf')),
            email_confirmed_at = now(),
            updated_at         = now()
        WHERE id = $1
      `, [userId, password]);
    } else {
      const { rows } = await client.query<{ id: string }>(`
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data,
          confirmation_token, recovery_token, email_change_token_new, email_change,
          is_super_admin, is_sso_user, is_anonymous
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated', 'authenticated',
          $1,
          crypt($2, gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('sub', gen_random_uuid()::text, 'email', $1::text, 'email_verified', false, 'phone_verified', false),
          '', '', '', '',
          false, false, false
        )
        RETURNING id
      `, [email, password]);
      userId = rows[0].id;
    }

    // Insert UUID-format identity (required by newer Supabase GoTrue)
    await client.query(`
      INSERT INTO auth.identities (
        id, user_id, provider_id, provider, identity_data, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, $2, 'email',
        jsonb_build_object('sub', $2::text, 'email', $3::text),
        now(), now()
      )
      ON CONFLICT (provider, provider_id) DO NOTHING
    `, [userId, userId, email]);

    await client.query('COMMIT');
    return userId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seed() {
  for (const u of USERS) {
    try {
      const id = await upsertUser(u.email, u.password);
      console.log(`✓ ${u.email} (id: ${id})`);
    } catch (err) {
      console.error(`✗ ${u.email}:`, err instanceof Error ? err.message : err);
    }
  }
  await pool.end();
}

seed();
