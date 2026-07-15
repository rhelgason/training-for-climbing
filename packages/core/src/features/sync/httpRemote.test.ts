import { HttpRemoteStore } from './httpRemote';
import { emptySnapshot } from './merge';

function mockFetch(impl: () => Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = jest.fn(async () => impl() as Response);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('HttpRemoteStore', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('downloads the snapshot and sends a bearer token to /snapshot', async () => {
    const snapshot = emptySnapshot();
    const fetchMock = mockFetch(() => ({ ok: true, json: async () => ({ data: snapshot }) }));

    const result = await new HttpRemoteStore('https://x.up.railway.app/', 'tok').download();

    expect(result).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://x.up.railway.app/snapshot',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
  });

  it('returns null when the remote has no snapshot', async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ data: null }) }));
    expect(await new HttpRemoteStore('https://x.app', 't').download()).toBeNull();
  });

  it('throws on a failed download', async () => {
    mockFetch(() => ({ ok: false, status: 401 }));
    await expect(new HttpRemoteStore('https://x.app', 't').download()).rejects.toThrow(/401/);
  });

  it('uploads with PUT, JSON body, and bearer auth', async () => {
    const fetchMock = mockFetch(() => ({ ok: true, json: async () => ({ ok: true }) }));
    await new HttpRemoteStore('https://x.app', 'tok').upload(emptySnapshot());

    const [calledUrl, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe('https://x.app/snapshot');
    expect(opts.method).toBe('PUT');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('throws on a failed upload', async () => {
    mockFetch(() => ({ ok: false, status: 500 }));
    await expect(new HttpRemoteStore('https://x.app', 't').upload(emptySnapshot())).rejects.toThrow(
      /500/,
    );
  });
});
