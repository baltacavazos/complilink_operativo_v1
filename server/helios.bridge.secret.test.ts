import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

const hosts = [
  'https://www.complilink.mx',
  'https://compli-mx-phtbkw9q.manus.space',
];

const secret = (process.env.AUDITAPATRON_ENGINE_HMAC_SECRET ?? '').trim();

function fingerprint(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(-16);
}

describe('Helios bridge secret alignment', () => {
  it('uses a loaded secret', () => {
    expect(secret.length).toBeGreaterThan(0);
  });

  it('returns 200 on contract endpoint with Authorization bearer', async () => {
    const results = await Promise.all(
      hosts.map(async (host) => {
        const response = await fetch(`${host}/api/internal/helios/bridge/contract`, {
          headers: {
            Authorization: `Bearer ${secret}`,
          },
        });

        return {
          host,
          status: response.status,
          body: await response.text(),
        };
      }),
    );

    expect(results, `Bearer failed with secret fingerprint ${fingerprint(secret)}:\n${JSON.stringify(results, null, 2)}`).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ host: 'https://www.complilink.mx', status: 200 }),
        expect.objectContaining({ host: 'https://compli-mx-phtbkw9q.manus.space', status: 200 }),
      ]),
    );
  }, 30000);

  it('returns 200 on contract endpoint with x-auditapatron-token', async () => {
    const results = await Promise.all(
      hosts.map(async (host) => {
        const response = await fetch(`${host}/api/internal/helios/bridge/contract`, {
          headers: {
            'x-auditapatron-token': secret,
          },
        });

        return {
          host,
          status: response.status,
          body: await response.text(),
        };
      }),
    );

    expect(results, `x-auditapatron-token failed with secret fingerprint ${fingerprint(secret)}:\n${JSON.stringify(results, null, 2)}`).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ host: 'https://www.complilink.mx', status: 200 }),
        expect.objectContaining({ host: 'https://compli-mx-phtbkw9q.manus.space', status: 200 }),
      ]),
    );
  }, 30000);
});
