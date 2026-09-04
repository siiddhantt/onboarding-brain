import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CompanyBrainNavigation } from '@/components/company-brain/CompanyBrainNavigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}

export default async function CompanyBrainLayout({ children, params }: LayoutProps) {
  const { organizationId } = await params;

  return (
    <PageContainer variant="dashboard" className="pb-12 pt-6 sm:pt-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Company brain"
          description="Reliable answers from your organization’s knowledge."
          className="mb-4"
        >
          <Button variant="outline" size="sm" asChild>
            <Link href={`/organizations/${organizationId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Organization
            </Link>
          </Button>
        </PageHeader>

        <CompanyBrainNavigation organizationId={organizationId} />
        <div className="pt-6">{children}</div>
      </div>
    </PageContainer>
  );
}
