'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Department } from '@app-starter/shared';
import { ChevronDown, Loader2, Save, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { OrganizationUser } from '@/lib/organizations-api';
import { departmentsApi } from '@/lib/departments-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const errorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === 'object' && 'message' in error ? String(error.message) : fallback;

interface DepartmentSettingsCardProps {
  organizationId: string;
  department: Department;
  members: OrganizationUser[];
  onChanged: () => Promise<void>;
}

export const DepartmentSettingsCard = ({
  organizationId,
  department,
  members,
  onChanged,
}: DepartmentSettingsCardProps) => {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description ?? '');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    setName(department.name);
    setDescription(department.description ?? '');
  }, [department.description, department.name]);

  const assignedMemberIds = useMemo(
    () => new Set(department.contacts.map((contact) => contact.organizationMemberId)),
    [department.contacts],
  );
  const availableMembers = members.filter((member) => !assignedMemberIds.has(member.id));
  const hasChanges =
    name.trim() !== department.name || description.trim() !== (department.description ?? '');

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    setPendingAction('save');
    try {
      await departmentsApi.update(organizationId, department.id, {
        name: name.trim(),
        description: description.trim(),
      });
      await onChanged();
      toast.success('Department updated');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the department.'));
    } finally {
      setPendingAction(null);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive ${department.name}?`)) return;

    setPendingAction('archive');
    try {
      await departmentsApi.archive(organizationId, department.id);
      await onChanged();
      toast.success('Department archived');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not archive the department.'));
    } finally {
      setPendingAction(null);
    }
  };

  const handleAssignContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMemberId) return;

    setPendingAction('assign');
    try {
      await departmentsApi.assignContact(organizationId, department.id, {
        organizationMemberId: selectedMemberId,
      });
      setSelectedMemberId('');
      await onChanged();
      toast.success('Department contact assigned');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not assign the department contact.'));
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    setPendingAction(contactId);
    try {
      await departmentsApi.removeContact(organizationId, department.id, contactId);
      await onChanged();
      toast.success('Department contact removed');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove the department contact.'));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <div>
            <CardTitle className="text-base">{department.name}</CardTitle>
            <CardDescription>
              {department.contacts.length}{' '}
              {department.contacts.length === 1 ? 'assigned contact' : 'assigned contacts'}
            </CardDescription>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <CardContent className="border-t pt-5">
          <div className="mb-5 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={pendingAction !== null}
              onClick={handleArchive}
            >
              {pendingAction === 'archive' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Archive
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`department-name-${department.id}`}>Name</Label>
                <Input
                  id={`department-name-${department.id}`}
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  disabled={pendingAction !== null}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`department-description-${department.id}`}>Description</Label>
                <Textarea
                  id={`department-description-${department.id}`}
                  value={description}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={pendingAction !== null}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!name.trim() || !hasChanges || pendingAction !== null}
              >
                {pendingAction === 'save' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
            </form>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Department contacts</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Contacts will become eligible routing targets in the escalation workflow.
                </p>
              </div>

              <div className="space-y-2">
                {department.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts assigned.</p>
                ) : (
                  department.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {contact.name || contact.email}
                        </p>
                        {contact.name && (
                          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${contact.name || contact.email} from ${department.name}`}
                        disabled={pendingAction !== null}
                        onClick={() => handleRemoveContact(contact.id)}
                      >
                        {pendingAction === contact.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAssignContact} className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  disabled={availableMembers.length === 0 || pendingAction !== null}
                >
                  <SelectTrigger aria-label={`Choose a contact for ${department.name}`}>
                    <SelectValue
                      placeholder={
                        availableMembers.length === 0 ? 'All members assigned' : 'Choose member'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.user.name || member.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!selectedMemberId || pendingAction !== null}
                >
                  {pendingAction === 'assign' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Assign
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </details>
    </Card>
  );
};
