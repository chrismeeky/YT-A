/**
 * Seeds users directly via DATABASE_URL (PostgreSQL).
 *   npx tsx scripts/seed-users.ts
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Parse DATABASE_URL manually — standard URL parsers choke on unencoded # in passwords
function parseDbUrl(url: string) {
  // postgresql://USER:PASSWORD@HOST:PORT/DB
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

const USERS = [
  { email: 'betatesting@gmail.com', password: 'Betatesting123!' },
];

async function upsertUser(email: string, password: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user already exists
    const { rows: existing } = await client.query<{ id: string }>(
      'SELECT id FROM auth.users WHERE email = $1', [email]
    );

    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id;
      // Update password and confirm email
      await client.query(`
        UPDATE auth.users
        SET encrypted_password = crypt($2, gen_salt('bf')),
            email_confirmed_at = now(),
            updated_at         = now()
        WHERE id = $1
      `, [userId, password]);
    } else {
      // Insert new user
      const { rows } = await client.query<{ id: string }>(`
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated', 'authenticated',
          $1,
          crypt($2, gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          false, false
        )
        RETURNING id
      `, [email, password]);
      userId = rows[0].id;
    }

    // Ensure auth.identities row exists (required for email login)
    // Pass userId twice to avoid type ambiguity ($1=uuid, $3=text)
    await client.query(`
      INSERT INTO auth.identities (
        id, user_id, provider_id, provider, identity_data, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, $2, 'email',
        jsonb_build_object('sub', $3::text, 'email', $2::text),
        now(), now()
      )
      ON CONFLICT (provider, provider_id) DO NOTHING
    `, [userId, email, userId]);

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
