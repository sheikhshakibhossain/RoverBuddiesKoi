import { createContext, useContext } from "react"

export type UserRole = "org-owner" | "team-manager" | "subteam-manager" | "member"

export interface AppUser {
  id: string
  name: string
  initials: string
  email: string
  role: UserRole
  team: string        // primary team assignment
  subteam: string     // primary subteam assignment
  batch: string
  whatsapp: string
}

export interface UserCtx {
  user: AppUser
  pagePerms: Record<string, string[]>
  setPagePerms: (p: Record<string, string[]>) => void
  featurePerms: Record<string, string[]>
  setFeaturePerms: (p: Record<string, string[]>) => void
}

export const UserContext = createContext<UserCtx | null>(null)

export function useUserCtx(): UserCtx {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUserCtx must be inside UserContext.Provider")
  return ctx
}

export function useUser(): AppUser {
  return useUserCtx().user
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function normalizeRole(roleStr: string): UserRole {
  if (!roleStr) return "member"
  const lower = roleStr.toLowerCase().replace("_", "-")
  if (lower.includes("owner")) return "org-owner"
  if (lower.includes("team-manager")) return "team-manager"
  if (lower.includes("subteam-manager")) return "subteam-manager"
  if (lower.includes("team") && !lower.includes("subteam")) return "team-manager"
  return "member"
}

export function roleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    "org-owner":       "Organization Owner",
    "team-manager":    "Team Manager",
    "subteam-manager": "Subteam Manager",
    "member":          "Member",
  }
  return map[role] || "Member"
}

export function canAccessPage(role: UserRole, page: string): boolean {
  const norm = normalizeRole(role)
  const matrix: Record<string, UserRole[]> = {
    dashboard: ["org-owner", "team-manager", "subteam-manager", "member"],
    members:   ["org-owner", "team-manager", "subteam-manager", "member"],
    search:    ["org-owner", "team-manager", "subteam-manager", "member"],
    heatmap:   ["org-owner", "team-manager", "subteam-manager"],
    skills:    ["org-owner", "team-manager", "subteam-manager", "member"],
    projects:  ["org-owner", "team-manager", "subteam-manager", "member"],
    "meeting-planner": ["org-owner", "team-manager"],
    portfolio: ["org-owner", "team-manager", "subteam-manager", "member"],
    settings:  ["org-owner", "team-manager", "member"],
  }
  return (matrix[page] ?? []).includes(norm)
}

// Scope helpers used by pages to filter data
export function teamScope(user: AppUser): string | null {
  const norm = normalizeRole(user.role)
  if (norm === "org-owner") return null                   // no restriction
  return user.team                                        // everyone else scoped to own team
}

export function subteamScope(user: AppUser): string | null {
  const norm = normalizeRole(user.role)
  if (norm === "org-owner" || norm === "team-manager") return null
  return user.subteam                                     // subteam-manager and member
}
