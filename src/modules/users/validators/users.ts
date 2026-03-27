import { z } from "zod";
import { UserRole } from "@/generated/prisma/enums";

export const userRoleSchema = z.union([
  z.literal(UserRole.USER),
  z.literal(UserRole.PRODUCT_OWNER),
  z.literal(UserRole.ADMIN),
  z.literal(UserRole.SUPER_ADMIN),
  z.literal(UserRole.DEVELOPER),
]);

export const userListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const createUserBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().trim().max(200).optional(),
  role: userRoleSchema,
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;

export const updateUserRoleBodySchema = z.object({
  role: userRoleSchema,
});

export type UpdateUserRoleBody = z.infer<typeof updateUserRoleBodySchema>;

export const setUserActiveBodySchema = z.object({
  isActive: z.boolean(),
});

export type SetUserActiveBody = z.infer<typeof setUserActiveBodySchema>;

/** PATCH /api/users/:id — exactly one of `role` or `isActive`. */
export const patchUserBodySchema = z
  .object({
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) => [d.role !== undefined, d.isActive !== undefined].filter(Boolean).length === 1,
    { message: "Send exactly one of role or isActive" },
  );

export type PatchUserBody = z.infer<typeof patchUserBodySchema>;
