import type { Department } from '@app-starter/shared';
import { Building2, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DepartmentDirectoryProps {
  departments: Department[];
}

export const DepartmentDirectory = ({ departments }: DepartmentDirectoryProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Departments</CardTitle>
      <CardDescription>
        Find the team responsible when company knowledge is missing.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {departments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No departments have been configured yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <section key={department.id} className="rounded-md border p-4">
              <div className="flex gap-3">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 space-y-1">
                  <h3 className="font-medium">{department.name}</h3>
                  {department.description && (
                    <p className="text-sm text-muted-foreground">{department.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t pt-3">
                {department.contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No contact assigned.</p>
                ) : (
                  department.contacts.map((contact) => (
                    <div key={contact.id} className="flex min-w-0 items-start gap-2 text-sm">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{contact.name || contact.email}</p>
                        {contact.name && (
                          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
