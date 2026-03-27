import { z } from "zod";

/** Shared with `src/auth.ts` credentials provider and login forms. */
export const credentialsLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** @deprecated Use credentialsLoginSchema */
export const credentialsFormSchema = credentialsLoginSchema;

export type CredentialsLoginInput = z.infer<typeof credentialsLoginSchema>;
export type CredentialsFormValues = CredentialsLoginInput;
