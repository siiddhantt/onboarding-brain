'use client';

import { use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { KnowledgeSourcesPanel } from '@/components/company-brain/KnowledgeSourcesPanel';
import { Card, CardContent } from '@/components/ui/card';
import { companyBrainApi } from '@/lib/company-brain-api';
import { organizationsApi } from '@/lib/organizations-api';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

export default function KnowledgePage({ params }: PageProps) {
  const { organizationId } = use(params);
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['company-brain-status', organizationId],
    queryFn: () => companyBrainApi.getStatus(organizationId),
  });
  const sourcesQuery = useQuery({
    queryKey: ['knowledge-sources', organizationId],
    queryFn: () => companyBrainApi.listSources(organizationId),
  });
  const roleQuery = useQuery({
    queryKey: ['organization-role', organizationId],
    queryFn: () => organizationsApi.getUserRoleInOrganization(organizationId),
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => companyBrainApi.uploadDocument(organizationId, file),
    onSuccess: async (source) => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-sources', organizationId] });
      if (source.status === 'READY') {
        toast.success('Document indexed');
      } else {
        toast.error(source.errorMessage || 'The document could not be indexed.');
      }
    },
  });

  if (statusQuery.isLoading || sourcesQuery.isLoading || roleQuery.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasLoadError = statusQuery.isError || sourcesQuery.isError || roleQuery.isError;
  const isConfigured = statusQuery.data?.isConfigured ?? false;
  const canManage = roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN';

  return (
    <div className="space-y-4">
      {hasLoadError && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Knowledge sources could not be loaded. Refresh the page and try again.
          </CardContent>
        </Card>
      )}
      {!hasLoadError && !isConfigured && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            The knowledge engine is not configured in this environment. Add the Cognee settings to
            the API environment to enable document indexing.
          </CardContent>
        </Card>
      )}
      {!hasLoadError && (
        <KnowledgeSourcesPanel
          sources={sourcesQuery.data?.items ?? []}
          canManage={canManage}
          isConfigured={isConfigured}
          isUploading={uploadMutation.isPending}
          onUpload={async (file) => {
            await uploadMutation.mutateAsync(file);
          }}
        />
      )}
    </div>
  );
}
