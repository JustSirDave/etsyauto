import '@testing-library/jest-dom';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';
import { resetApiClientStateForTests } from '@/lib/api';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  resetApiClientStateForTests();
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost/',
    origin: 'http://localhost',
    hostname: 'localhost',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
  configurable: true,
});
