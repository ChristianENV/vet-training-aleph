"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { roleHasPermission } from "@/lib/auth/permissions";
import { createUserBodySchema } from "@/modules/users/validators/users";
import type { CreateUserBody } from "@/modules/users/validators/users";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { rolesForCreate, rolesForReassign } from "./role-helpers";
import {
  createUserRequest,
  fetchUsersList,
  patchUserActiveRequest,
  patchUserRoleRequest,
  type UserListItem,
} from "./users-api";

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.USER]: "Learner",
  [UserRole.PRODUCT_OWNER]: "Product owner",
  [UserRole.ADMIN]: "Admin",
  [UserRole.SUPER_ADMIN]: "Super admin",
  [UserRole.DEVELOPER]: "Developer",
};

function selectClassName() {
  return "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
}

type Props = {
  actorRole: UserRole;
};

export function UsersDirectory({ actorRole }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const listQuery = useMemo(
    () => ({ q: debouncedSearch || undefined, take: 50 }),
    [debouncedSearch],
  );

  const usersQuery = useQuery({
    queryKey: ["users", listQuery],
    queryFn: () => fetchUsersList(listQuery),
  });

  const createMutation = useMutation({
    mutationFn: createUserRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      patchUserRoleRequest(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const activeMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      patchUserActiveRequest(userId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const canCreate = roleHasPermission(actorRole, "users:create");
  const canAssign = roleHasPermission(actorRole, "users:assign_role");
  const canToggleActive = roleHasPermission(actorRole, "users:deactivate");

  const createRoles = useMemo(() => rolesForCreate(actorRole), [actorRole]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Label htmlFor="user-search">Search</Label>
          <Input
            id="user-search"
            placeholder="Email or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>
        {canCreate ? (
          <CreateUserDialog
            createRoles={createRoles}
            mutation={createMutation}
            defaultRole={createRoles[0] ?? UserRole.USER}
          />
        ) : null}
      </div>

      {!canCreate ? (
        <p className="text-muted-foreground max-w-2xl text-sm">
          Your role can search this directory. Creating users or changing roles requires an admin, super admin,
          or developer account.
        </p>
      ) : null}

      {usersQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading users…</p>
      ) : usersQuery.isError ? (
        <p className="text-destructive text-sm">
          {usersQuery.error instanceof Error ? usersQuery.error.message : "Failed to load users"}
        </p>
      ) : usersQuery.data?.users.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {debouncedSearch
            ? "No users match this search. Try a different email or name."
            : "No users in the directory yet."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[220px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.data?.users.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.email}</TableCell>
                <TableCell>{row.name ?? "—"}</TableCell>
                <TableCell>{ROLE_LABEL[row.role]}</TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <RowActions
                    actorRole={actorRole}
                    row={row}
                    canAssign={canAssign}
                    canToggleActive={canToggleActive}
                    roleMutation={roleMutation}
                    activeMutation={activeMutation}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CreateUserDialog({
  createRoles,
  mutation,
  defaultRole,
}: {
  createRoles: UserRole[];
  mutation: {
    mutateAsync: (body: CreateUserBody) => Promise<unknown>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
  };
  defaultRole: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateUserBody>({
    resolver: zodResolver(createUserBodySchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      role: defaultRole,
    },
  });

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Create user
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <form
          onSubmit={form.handleSubmit(async (values) => {
            await mutation.mutateAsync(values);
            setOpen(false);
            form.reset({ email: "", password: "", name: "", role: defaultRole });
          })}
        >
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cu-email">Email</Label>
              <Input id="cu-email" type="email" autoComplete="off" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cu-password">Password</Label>
              <Input
                id="cu-password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              <p className="text-muted-foreground text-xs">At least 8 characters.</p>
              {form.formState.errors.password ? (
                <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cu-name">Name (optional)</Label>
              <Input id="cu-name" {...form.register("name")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cu-role">Role</Label>
              <select
                id="cu-role"
                className={selectClassName()}
                {...form.register("role")}
                value={form.watch("role")}
                onChange={(e) => form.setValue("role", e.target.value as UserRole)}
              >
                {createRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            {mutation.isError ? (
              <p className="text-sm text-destructive">
                {mutation.error instanceof Error ? mutation.error.message : "Create failed"}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function RowActions({
  actorRole,
  row,
  canAssign,
  canToggleActive,
  roleMutation,
  activeMutation,
}: {
  actorRole: UserRole;
  row: UserListItem;
  canAssign: boolean;
  canToggleActive: boolean;
  roleMutation: {
    mutateAsync: (p: { userId: string; role: UserRole }) => Promise<unknown>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    variables?: { userId: string; role: UserRole };
  };
  activeMutation: {
    mutateAsync: (p: { userId: string; isActive: boolean }) => Promise<unknown>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    variables?: { userId: string; isActive: boolean };
  };
}) {
  const target = { role: row.role, isProtectedAccount: false };
  const reassignRoles = useMemo(
    () => rolesForReassign(actorRole, target),
    [actorRole, row.role],
  );

  const [roleOpen, setRoleOpen] = useState(false);
  const [nextRole, setNextRole] = useState<UserRole>(row.role);

  useEffect(() => {
    setNextRole(row.role);
  }, [row.role, roleOpen]);

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canAssign && reassignRoles.length > 1 ? (
        <>
          <Button size="sm" variant="outline" type="button" onClick={() => setRoleOpen(true)}>
            Change role
          </Button>
          <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change role for {row.email}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor={`role-${row.id}`}>Role</Label>
              <select
                id={`role-${row.id}`}
                className={selectClassName()}
                value={nextRole}
                onChange={(e) => setNextRole(e.target.value as UserRole)}
              >
                {reassignRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              {roleMutation.isError ? (
                <p className="text-sm text-destructive">
                  {roleMutation.error instanceof Error
                    ? roleMutation.error.message
                    : "Update failed"}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                disabled={
                  (roleMutation.isPending && roleMutation.variables?.userId === row.id) ||
                  nextRole === row.role
                }
                onClick={async () => {
                  await roleMutation.mutateAsync({ userId: row.id, role: nextRole });
                  setRoleOpen(false);
                }}
              >
                {roleMutation.isPending && roleMutation.variables?.userId === row.id
                  ? "Saving…"
                  : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
      ) : null}

      {canToggleActive ? (
        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            variant={row.isActive ? "outline" : "default"}
            disabled={
              activeMutation.isPending &&
              activeMutation.variables?.userId === row.id
            }
            onClick={() =>
              void activeMutation.mutateAsync({ userId: row.id, isActive: !row.isActive })
            }
          >
            {activeMutation.isPending && activeMutation.variables?.userId === row.id
              ? row.isActive
                ? "Deactivating…"
                : "Activating…"
              : row.isActive
                ? "Deactivate"
                : "Activate"}
          </Button>
          {activeMutation.isError && activeMutation.variables?.userId === row.id ? (
            <p className="text-destructive max-w-[14rem] text-right text-xs">
              {activeMutation.error instanceof Error ? activeMutation.error.message : "Update failed"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
