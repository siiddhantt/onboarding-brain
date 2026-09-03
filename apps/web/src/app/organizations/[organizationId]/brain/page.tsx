'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { KnowledgeSourcesPanel } from '@/components/company-brain/KnowledgeSourcesPanel';
import { QuestionAnswerPanel } from '@/components/company-brain/QuestionAnswerPanel';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { companyBrainApi } from '@/lib/company-brain-api';
import { organizationsApi } from '@/lib/organizations-api';
import { DepartmentDirectory } from '@/components/departments/DepartmentDirectory';
import { departmentsApi } from '@/lib/departments-api';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

export default function CompanyBrainPage({ params }: PageProps) {
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
  const departmentsQuery = useQuery({
    queryKey: ['departments', organizationId],
    queryFn: () => departmentsApi.list(organizationId),
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

  const isLoading =
    statusQuery.isLoading ||
    sourcesQuery.isLoading ||
    roleQuery.isLoading ||
    departmentsQuery.isLoading;
  const hasLoadError =
    statusQuery.isError || sourcesQuery.isError || roleQuery.isError || departmentsQuery.isError;
  const isConfigured = statusQuery.data?.isConfigured ?? false;
  const canManage = roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN';

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="dashboard">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Company brain"
          description="Add onboarding knowledge and ask questions against it."
        >
          <Button variant="outline" asChild>
            <Link href={`/organizations/${organizationId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Organization
            </Link>
          </Button>
        </PageHeader>

        {!hasLoadError && !isConfigured && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-4 text-sm">
              The knowledge engine is not configured in this environment. Add the Cognee settings to
              the API environment to enable uploads and questions.
            </CardContent>
          </Card>
        )}

        {hasLoadError && (
          <Card className="border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">
              The company brain could not be loaded. Refresh the page and try again.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <QuestionAnswerPanel
            isConfigured={isConfigured}
            onAsk={(question) => companyBrainApi.ask(organizationId, question)}
          />
          <KnowledgeSourcesPanel
            sources={sourcesQuery.data?.items ?? []}
            canManage={canManage}
            isConfigured={isConfigured}
            isUploading={uploadMutation.isPending}
            onUpload={async (file) => {
              await uploadMutation.mutateAsync(file);
            }}
          />
        </div>

        <DepartmentDirectory departments={departmentsQuery.data?.items ?? []} />
      </div>
    </PageContainer>
  );
}
