"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleHasPermission } from "@/lib/auth/permissions";
import { QueryErrorHint, QueryLoadingHint } from "@/components/shared/query-status";
import {
  createSessionRequest,
  fetchSessionsList,
  fetchTemplates,
} from "./sessions-api";
import { SESSION_STATUS_LABEL, SESSION_TYPE_LABEL } from "./session-labels";

type Props = {
  actorRole: UserRole;
};

export function SessionsHome({ actorRole }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canUse = roleHasPermission(actorRole, "sessions:use");

  const templatesQuery = useQuery({
    queryKey: ["session-templates"],
    queryFn: () => fetchTemplates(),
  });

  const sessionsQuery = useQuery({
    queryKey: ["training-sessions", { take: 30 }],
    queryFn: () => fetchSessionsList({ take: 30 }),
  });

  const createMutation = useMutation({
    mutationFn: (templateId: string) => createSessionRequest(templateId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-sessions"] });
      router.push(`/sessions/${data.session.id}`);
    },
  });

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Templates</h2>
          <p className="text-muted-foreground text-sm">
            Each template is an ordered set of prompts. Create a run, press Start, then save an answer
            for each question (transcript for now; voice capture later).
          </p>
        </div>
        {templatesQuery.isLoading ? (
          <QueryLoadingHint>Loading templates…</QueryLoadingHint>
        ) : templatesQuery.isError ? (
          <QueryErrorHint>
            {templatesQuery.error instanceof Error
              ? templatesQuery.error.message
              : "Could not load templates"}
          </QueryErrorHint>
        ) : templatesQuery.data?.templates.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No published templates</CardTitle>
              <CardDescription>
                Run the database seed to load session templates.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templatesQuery.data?.templates.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <CardDescription>
                    {SESSION_TYPE_LABEL[t.sessionType]}
                    {t.description ? ` · ${t.description}` : null}
                    {" · "}
                    {t._count?.questions ?? t.questions?.length ?? 0} question
                    {(t._count?.questions ?? t.questions?.length ?? 0) === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {canUse ? (
                    <Button
                      size="sm"
                      disabled={createMutation.isPending}
                      onClick={() => createMutation.mutate(t.id)}
                    >
                      {createMutation.isPending ? "Creating…" : "Start new session"}
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Your role can review sessions but not start new training runs.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {createMutation.isError ? (
          <p className="text-destructive text-sm">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "Could not create session"}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Your recent sessions</h2>
          <p className="text-muted-foreground text-sm">
            {roleHasPermission(actorRole, "sessions:view_any")
              ? "Recent sessions (organization-wide for privileged roles)."
              : "Sessions you have created."}
          </p>
        </div>
        {sessionsQuery.isLoading ? (
          <QueryLoadingHint>Loading history…</QueryLoadingHint>
        ) : sessionsQuery.isError ? (
          <QueryErrorHint>
            {sessionsQuery.error instanceof Error
              ? sessionsQuery.error.message
              : "Could not load sessions"}
          </QueryErrorHint>
        ) : sessionsQuery.data?.sessions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No sessions yet</CardTitle>
              <CardDescription>
                {canUse
                  ? "Create a session from a template above to begin."
                  : "No sessions match your filters."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionsQuery.data?.sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.title ?? s.template?.title ?? "Session"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.template ? SESSION_TYPE_LABEL[s.template.sessionType] : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{SESSION_STATUS_LABEL[s.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(s.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/sessions/${s.id}`}>
                      <Button size="sm" variant="outline" type="button">
                        Open
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
