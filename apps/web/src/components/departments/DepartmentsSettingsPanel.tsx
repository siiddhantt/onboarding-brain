'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { OrganizationUser } from '@/lib/organizations-api';
import { departmentsApi } from '@/lib/departments-api';
import { DepartmentDirectory } from '@/components/departments/DepartmentDirectory';
import { DepartmentSettingsCard } from '@/components/departments/DepartmentSettingsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const errorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === 'object' && 'message' in error ? String(error.message) : fallback;

interface DepartmentsSettingsPanelProps {
  organizationId: string;
  members: OrganizationUser[];
  canManage: boolean;
}

export const DepartmentsSettingsPanel = ({
  organizationId,
  members,
  canManage,
}: DepartmentsSettingsPanelProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const departmentsQuery = useQuery({
    queryKey: ['departments', organizationId],
    queryFn: () => departmentsApi.list(organizationId),
  });

  const handleChanged = async () => {
    await departmentsQuery.refetch();
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await departmentsApi.create(organizationId, {
        name: name.trim(),
        description: description.trim(),
      });
      setName('');
      setDescription('');
      await handleChanged();
      toast.success('Department created');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the department.'));
    } finally {
      setIsCreating(false);
    }
  };

  if (departmentsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (departmentsQuery.isError) {
    return <p className="text-sm text-destructive">Departments could not be loaded.</p>;
  }

  const departments = departmentsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a department</CardTitle>
            <CardDescription>
              Departments organize company ownership and provide targets for future question
              routing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="new-department-name">Name</Label>
                <Input
                  id="new-department-name"
                  value={name}
                  maxLength={100}
                  placeholder="Finance"
                  onChange={(event) => setName(event.target.value)}
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-department-description">Description</Label>
                <Input
                  id="new-department-description"
                  value={description}
                  maxLength={500}
                  placeholder="Expenses, purchasing, and company cards"
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isCreating}
                />
              </div>
              <Button type="submit" className="self-end" disabled={!name.trim() || isCreating}>
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only organization owners and admins can configure departments and contacts.
        </p>
      )}

      {departments.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No departments have been configured yet.
        </div>
      ) : canManage ? (
        departments.map((department) => (
          <DepartmentSettingsCard
            key={department.id}
            organizationId={organizationId}
            department={department}
            members={members}
            onChanged={handleChanged}
          />
        ))
      ) : (
        <DepartmentDirectory departments={departments} />
      )}
    </div>
  );
};
