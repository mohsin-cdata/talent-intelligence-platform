// API client wrapper that attaches per-user credentials as headers

import { useAuthStore } from './auth-store';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiClient(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  if (!skipAuth) {
    const creds = useAuthStore.getState().decryptedCredentials;

    if (creds?.llm) {
      headers.set('X-LLM-Provider', creds.llm.provider);
      headers.set('X-LLM-API-Key', creds.llm.apiKey);
      headers.set('X-LLM-Model', creds.llm.model);
    }

    if (creds?.cdata) {
      headers.set('X-CData-Email', creds.cdata.email);
      headers.set('X-CData-PAT', creds.cdata.pat);
      if (creds.cdata.endpoint) {
        headers.set('X-CData-Endpoint', creds.cdata.endpoint);
      }
    }

    if (creds?.dataSource?.lockedTables?.length) {
      headers.set('X-Locked-Tables', JSON.stringify(creds.dataSource.lockedTables));
    }
  }

  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...fetchOptions, headers });
}

export const api = {
  post: (url: string, body: any, options?: FetchOptions) =>
    apiClient(url, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  get: (url: string, options?: FetchOptions) =>
    apiClient(url, { method: 'GET', ...options }),
};
