import type { ConfigService } from '@nestjs/config';

export const cogneeDatasetName = (
  configService: Pick<ConfigService, 'get'>,
  organizationId: string,
): string => {
  const prefix = configService.get<string>('COGNEE_DATASET_PREFIX', 'organization');
  return `${prefix}-${organizationId}`;
};
