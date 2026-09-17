/**
 * One-off host OAuth consent → offline refresh token (SEC-03, D-07).
 * Run outside Docker; write result to secrets/<member>/google_refresh_token.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { join, resolve } from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CALENDAR_SCOPE } from '../src/writers/google/auth.ts';

const DEFAULT_SECRETS_DIR = 'secrets/serhiy';
const DEFAULT_PORT = 3333;

function readSecretFile(dir: string, name: string): string {
  const path = join(dir, name);
  return readFileSync(path, 'utf8').trim();
}

function parseArgs(argv: string[]): {
  secretsDir: string;
  port: number;
  write: boolean;
  loopbackHost: '127.0.0.1' | 'localhost';
} {
  let secretsDir = DEFAULT_SECRETS_DIR;
  let port = DEFAULT_PORT;
  let write = false;
  let loopbackHost: '127.0.0.1' | 'localhost' = '127.0.0.1';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') {
      write = true;
      continue;
    }
    if (arg === '--localhost') {
      loopbackHost = 'localhost';
      continue;
    }
    if (arg === '--secrets-dir' && argv[i + 1]) {
      secretsDir = argv[++i];
      continue;
    }
    if (arg === '--port' && argv[i + 1]) {
      const portStr = argv[++i];
      port = Number.parseInt(portStr, 10);
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Invalid --port: ${portStr}`);
      }
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npx tsx scripts/google-oauth-refresh-token.mts [options]

Options:
  --secrets-dir <path>  Directory with google_client_id / google_client_secret
                        (default: ${DEFAULT_SECRETS_DIR})
  --port <n>            Loopback port (default: ${DEFAULT_PORT})
  --localhost           Use http://localhost:<port>/oauth2callback (not 127.0.0.1)
  --write               Write refresh token to <secrets-dir>/google_refresh_token
  -h, --help            Show this help

GCP (403 on consent page):
  • Consent screen in Testing → add your Google account under Test users.
  • Web OAuth client → Authorized redirect URIs must match exactly (host + port + path).
  • Desktop OAuth client → use client_id/secret from JSON "installed", not "web".
  • Enable Google Calendar API on the same GCP project as the OAuth client.`);
      process.exit(0);
    }
  }

  return {
    secretsDir: resolve(process.cwd(), secretsDir),
    port,
    write,
    loopbackHost,
  };
}

async function main(): Promise<void> {
  const { secretsDir, port, write, loopbackHost } = parseArgs(
    process.argv.slice(2),
  );
  const redirectUri = `http://${loopbackHost}:${port}/oauth2callback`;

  const clientId = readSecretFile(secretsDir, 'google_client_id');
  const clientSecret = readSecretFile(secretsDir, 'google_client_secret');

  const oauth2 = new OAuth2Client(clientId, clientSecret, redirectUri);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GOOGLE_CALENDAR_SCOPE],
  });

  console.log(`Secrets: ${secretsDir}`);
  console.log(`Redirect: ${redirectUri}\n`);
  console.log('Open this URL if the browser does not open:\n');
  console.log(authUrl);
  console.log('');

  try {
    execSync(`open ${JSON.stringify(authUrl)}`, { stdio: 'ignore' });
  } catch {
    // non-macOS or no `open`
  }

  await new Promise<void>((resolvePromise, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const path = req.url?.split('?')[0] ?? '';
        if (path !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const url = new URL(req.url ?? '', redirectUri);
        const err = url.searchParams.get('error');
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end(`OAuth error: ${err}`);
          reject(new Error(`OAuth error: ${err}`));
          server.close();
          return;
        }

        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing authorization code');
          reject(new Error('Missing authorization code'));
          server.close();
          return;
        }

        const { tokens } = await oauth2.getToken(code);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Success — check the terminal for the refresh token.');

        if (!tokens.refresh_token) {
          reject(
            new Error(
              'No refresh_token in response. Revoke app at https://myaccount.google.com/permissions and run again.',
            ),
          );
          server.close();
          return;
        }

        const refreshToken = tokens.refresh_token;
        if (write) {
          const outPath = join(secretsDir, 'google_refresh_token');
          writeFileSync(outPath, refreshToken, 'utf8');
          console.log(`Wrote ${outPath}`);
        } else {
          console.log('Refresh token (store in google_refresh_token):\n');
          console.log(refreshToken);
          console.log(
            '\nTo write the file: re-run with --write, or:\n' +
              `  printf '%s' '<token>' > ${join(secretsDir, 'google_refresh_token')}`,
          );
        }

        server.close();
        resolvePromise();
      } catch (e) {
        reject(e);
        server.close();
      }
    });

    server.listen(port, loopbackHost, () => {
      console.log(`Listening on ${redirectUri}`);
    });

    server.on('error', reject);
  });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
