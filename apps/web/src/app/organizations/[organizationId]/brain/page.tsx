'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { QuestionAnswerPanel } from '@/components/company-brain/QuestionAnswerPanel';
import { Card, CardContent } from '@/components/ui/card';
import { companyBrainApi } from '@/lib/company-brain-api';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

export default function CompanyBrainPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const router = useRouter();

  const statusQuery = useQuery({
    queryKey: ['company-brain-status', organizationId],
    queryFn: () => companyBrainApi.getStatus(organizationId),
  });
  const isConfigured = statusQuery.data?.isConfigured ?? false;

  if (statusQuery.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!statusQuery.isError && !isConfigured && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            The knowledge engine is not configured in this environment. Add the Cognee settings to
            the API environment to enable questions.
          </CardContent>
        </Card>
      )}

      {statusQuery.isError && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Company knowledge could not be loaded. Refresh the page and try again.
          </CardContent>
        </Card>
      )}

      <QuestionAnswerPanel
        isConfigured={isConfigured}
        onAsk={(question) => companyBrainApi.ask(organizationId, question)}
        onOpenDirectory={() => router.push(`/organizations/${organizationId}/brain/directory`)}
      />
    </div>
  );
}
