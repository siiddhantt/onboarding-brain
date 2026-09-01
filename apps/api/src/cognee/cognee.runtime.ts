import type { Cognee } from '@cognee/cognee-ts';

export const COGNEE_RUNTIME_FACTORY = Symbol('COGNEE_RUNTIME_FACTORY');

export interface CogneeRuntime {
  client: Pick<Cognee, 'remember' | 'search' | 'warm'>;
  shutdown: () => void;
}

export type CogneeRuntimeFactory = (settings: Record<string, unknown>) => Promise<CogneeRuntime>;

/**
 * Loads the native Cognee runtime only when the integration is first used.
 * Keeping this import lazy lets the starter boot normally when Cognee is
 * disabled, including on platforms for which no native binding is available.
 */
export const createCogneeRuntime: CogneeRuntimeFactory = async (settings) => {
  // Nest owns environment loading and application logging in this process.
  process.env.COGNEE_DISABLE_DOTENV ??= '1';
  process.env.COGNEE_BINDING_SUPPRESS_LOGS ??= '1';

  const { Cognee, init, shutdown } = await import('@cognee/cognee-ts');

  init();

  return {
    client: new Cognee(settings),
    shutdown,
  };
};
