"use client";

import { createContext, useContext } from "react";
import type { PharmaUser, StudentProfile, FacilitatorProfile } from "./schema";

export type CurrentUser =
  | (PharmaUser & { student_profiles: StudentProfile | null })
  | (PharmaUser & { facilitator_profiles: FacilitatorProfile | null })
  | PharmaUser;

const CurrentUserContext = createContext<CurrentUser | null>(null);
export const CurrentUserProvider = CurrentUserContext.Provider;

/**
 * Returns the user DashboardLayout already resolved via getCurrentUser() —
 * avoids every dashboard page independently re-running that auth+profile
 * round trip on every sidebar navigation.
 */
export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}
