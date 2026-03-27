"use client";

import { useSession } from "next-auth/react";

/** Thin wrapper for client components that need session state. */
export function useSessionUser() {
  return useSession();
}
