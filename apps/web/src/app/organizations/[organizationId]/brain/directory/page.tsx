'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DepartmentDirectory } from '@/components/departments/DepartmentDirectory';
import { Card, CardContent } from '@/components/ui/card';
import { departmentsApi } from '@/lib/departments-api';
import { organizationsApi } from '@/lib/organizations-api';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

export default function DirectoryPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const departmentsQuery = useQuery({
    queryKey: ['departments', organizationId],
    queryFn: () => departmentsApi.list(organizationId),
  });
  const roleQuery = useQuery({
    queryKey: ['organization-role', organizationId],
    queryFn: () => organizationsApi.getUserRoleInOrganization(organizationId),
  });

  if (departmentsQuery.isLoading || roleQuery.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (departmentsQuery.isError || roleQuery.isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-4 text-sm text-destructive">
          The department directory could not be loaded. Refresh the page and try again.
        </CardContent>
      </Card>
    );
  }

  const canManage = roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN';

  return (
    <DepartmentDirectory
      departments={departmentsQuery.data?.items ?? []}
      manageHref={
        canManage ? `/organizations/${organizationId}/settings?section=departments` : undefined
      }
    />
  );
}
