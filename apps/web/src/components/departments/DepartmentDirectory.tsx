import type { Department } from '@app-starter/shared';
import Link from 'next/link';
import { Building2, Mail, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DepartmentDirectoryProps {
  departments: Department[];
  manageHref?: string;
}

export const DepartmentDirectory = ({ departments, manageHref }: DepartmentDirectoryProps) => (
  <Card className="overflow-hidden">
    <CardHeader className="border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
      <div className="space-y-1.5">
        <CardTitle className="text-lg">Department directory</CardTitle>
        <CardDescription>
          Find the team responsible when company knowledge is missing.
        </CardDescription>
      </div>
      {manageHref && (
        <Button variant="outline" size="sm" asChild>
          <Link href={manageHref}>
            <Settings2 className="mr-2 h-4 w-4" />
            Manage
          </Link>
        </Button>
      )}
    </CardHeader>
    <CardContent className="p-5 sm:p-6">
      {departments.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <Building2 className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium">No departments have been configured yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Departments connect unanswered questions to the right people.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {departments.map((department) => (
            <section key={department.id} className="rounded-lg border bg-card p-4">
              <div className="flex gap-3">
                <div className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="font-medium">{department.name}</h3>
                  {department.description && (
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {department.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t pt-3">
                {department.contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No contact assigned.</p>
                ) : (
                  department.contacts.slice(0, 3).map((contact) => (
                    <div key={contact.id} className="flex min-w-0 items-start gap-2 text-sm">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{contact.name || contact.email}</p>
                        <a
                          href={`mailto:${contact.email}`}
                          className="block truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    </div>
                  ))
                )}
                {department.contacts.length > 3 && (
                  <details className="pt-1 text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                      {department.contacts.length - 3} more contacts
                    </summary>
                    <div className="mt-2 space-y-2 pl-5">
                      {department.contacts.slice(3).map((contact) => (
                        <div key={contact.id} className="min-w-0">
                          <p className="truncate font-medium">{contact.name || contact.email}</p>
                          <a
                            href={`mailto:${contact.email}`}
                            className="block truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            {contact.email}
                          </a>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
