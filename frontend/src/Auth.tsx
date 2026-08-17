import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Building2, Loader2, UploadCloud, CheckCircle2, ArrowLeft,
  Shield, Users, Layers, User, Eye, EyeOff, Clock,
} from "lucide-react"
import type { AppUser, UserRole } from "@/lib/user-context"
import { roleLabel, normalizeRole } from "@/lib/user-context"
import { authApi } from "@/lib/api"

function formatDhakaTime(date: Date = new Date()): string {
  try {
    return date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  } catch {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
  }
}

// ─── Demo profiles (one per role) ─────────────────────────────────────────────

const DEMO_BY_ROLE: Record<UserRole, AppUser> = {
  "org-owner": {
    id: "u0", name: "Tanvir Hossain", initials: "TH", email: "tanvir@cairlab.org",
    role: "org-owner", team: "UMRT", subteam: "Software", batch: "2020", whatsapp: "8801900000001",
  },
  "team-manager": {
    id: "u1", name: "Rezwan Ahmed", initials: "RA", email: "rezwan@cairlab.org",
    role: "team-manager", team: "URRT", subteam: "Software", batch: "2021", whatsapp: "880123456783",
  },
  "subteam-manager": {
    id: "u2", name: "Nusrat Jahan", initials: "NJ", email: "nusrat@cairlab.org",
    role: "subteam-manager", team: "UMRT", subteam: "Electrical", batch: "2023", whatsapp: "880123456780",
  },
  "member": {
    id: "u3", name: "Aryan Hossain", initials: "AH", email: "aryan@cairlab.org",
    role: "member", team: "UMRT", subteam: "Software", batch: "2022", whatsapp: "880123456789",
  },
}

// ─── Role metadata ─────────────────────────────────────────────────────────────

interface RoleCard {
  role: UserRole
  label: string
  description: string
  scope: string
  icon: React.ReactNode
  accentVar: string   // CSS color token string for the colored left border / icon
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: "org-owner",
    label: "Organization Owner",
    description: "Full org access — manage teams, roles & semesters",
    scope: "All teams",
    icon: <Shield size={18} />,
    accentVar: "oklch(0.98 0 0)",
  },
  {
    role: "team-manager",
    label: "Team Manager",
    description: "Manage your assigned team and its subteams",
    scope: "Team-scoped",
    icon: <Users size={18} />,
    accentVar: "oklch(0.75 0.15 80)",
  },
  {
    role: "subteam-manager",
    label: "Subteam Manager",
    description: "Manage members and skills within your subteam",
    scope: "Subteam-scoped",
    icon: <Layers size={18} />,
    accentVar: "oklch(0.65 0.15 150)",
  },
  {
    role: "member",
    label: "Member",
    description: "Upload routine, request skills & find teammates",
    scope: "Own subteam",
    icon: <User size={18} />,
    accentVar: "oklch(0.65 0 0)",
  },
]

// ─── Shared style constants ────────────────────────────────────────────────────

const BG_PAGE  = "oklch(0.07 0.003 285)"
const BG_CARD  = "oklch(0.115 0.004 285)"
const BG_INPUT = "oklch(0.09 0.003 285)"
const BORDER   = "oklch(0.22 0.005 285)"
const BORDER_HI= "oklch(0.30 0.005 285)"
const BG_FOOT  = "oklch(0.09 0.003 285)"
const CARD_SHADOW = "0 32px 80px oklch(0 0 0 / 0.6), 0 0 0 1px oklch(0.28 0.005 285 / 0.3)"

// ─── Reusable field ────────────────────────────────────────────────────────────

function Field({
  id, label, type = "text", placeholder, value, onChange, suffix,
}: {
  id: string; label: string; type?: string; placeholder?: string
  value: string; onChange: (v: string) => void; suffix?: React.ReactNode
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === "password"
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword ? (show ? "text" : "password") : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-10 text-sm pr-9"
          style={{ background: BG_INPUT, borderColor: BORDER }}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

function SelectField({
  id, label, value, onChange, options,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="h-10 text-sm"
          style={{ background: BG_INPUT, borderColor: BORDER }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── Card shell ────────────────────────────────────────────────────────────────

function AuthCard({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div
      className="relative w-full max-w-[440px] rounded-2xl border overflow-hidden"
      style={{ background: BG_CARD, borderColor: BORDER, boxShadow: CARD_SHADOW }}
    >
      <div className="p-8">{children}</div>
      <div
        className="px-8 py-3 flex items-center justify-center border-t"
        style={{ background: BG_FOOT, borderColor: "oklch(0.18 0.005 285)" }}
      >
        {footer ?? (
          <span className="text-[11px] text-muted-foreground/50 font-mono tracking-wide">
            CAIR Lab · Robotics Division · Fall 2026
          </span>
        )}
      </div>
    </div>
  )
}

function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className="w-[54px] h-[54px] rounded-[14px] flex items-center justify-center"
        style={{ background: "oklch(0.98 0 0)", boxShadow: "0 4px 20px oklch(0 0 0 / 0.4)" }}
      >
        <Building2 size={26} style={{ color: "oklch(0.12 0.005 285)" }} />
      </div>
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">RoverBuddies</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Step 1 — Role selector ────────────────────────────────────────────────────

function RoleSelector({ onSelect }: { onSelect: (role: UserRole) => void }) {
  const [hovered, setHovered] = useState<UserRole | null>(null)

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: BG_PAGE }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 700px 400px at 50% 45%, oklch(0.20 0.005 285 / 0.3) 0%, transparent 70%)",
      }} />

      <div className="relative w-full max-w-[480px] space-y-5">
        {/* Header */}
        <div className="text-center space-y-1 mb-6">
          <div
            className="w-[54px] h-[54px] rounded-[14px] flex items-center justify-center mx-auto mb-4"
            style={{ background: "oklch(0.98 0 0)", boxShadow: "0 4px 20px oklch(0 0 0 / 0.4)" }}
          >
            <Building2 size={26} style={{ color: "oklch(0.12 0.005 285)" }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">RoverBuddies</h1>
          <p className="text-sm text-muted-foreground">Team Availability Management · CAIR Lab</p>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 text-center">
          Sign in or register as
        </p>

        {/* Role cards */}
        <div className="space-y-2.5">
          {ROLE_CARDS.map(card => {
            const isHov = hovered === card.role
            return (
              <button
                key={card.role}
                onClick={() => onSelect(card.role)}
                onMouseEnter={() => setHovered(card.role)}
                onMouseLeave={() => setHovered(null)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all duration-150 group"
                style={{
                  background: isHov ? "oklch(0.14 0.004 285)" : "oklch(0.115 0.004 285)",
                  borderColor: isHov ? BORDER_HI : BORDER,
                  boxShadow: isHov ? "0 0 0 1px oklch(0.30 0.005 285 / 0.4)" : "none",
                }}
              >
                {/* Accent bar */}
                <div
                  className="w-[3px] self-stretch rounded-full shrink-0 transition-opacity duration-150"
                  style={{ background: card.accentVar, opacity: isHov ? 1 : 0.35 }}
                />

                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center transition-all duration-150"
                  style={{
                    background: isHov ? "oklch(0.22 0.005 285)" : "oklch(0.17 0.005 285)",
                    color: card.accentVar,
                  }}
                >
                  {card.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{card.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.description}</p>
                </div>

                {/* Scope pill */}
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0"
                  style={{
                    borderColor: card.accentVar + "44",
                    color: card.accentVar,
                    background: card.accentVar + "10",
                  }}
                >
                  {card.scope}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/40 font-mono tracking-wide pt-2">
          CAIR Lab · Robotics Division · Fall 2026
        </p>
      </div>
    </div>
  )
}

// ─── Step 2 — Login & Register ───────────────────────────────────────────────

export function AuthForms({
  initialTab = "login",
  onLogin
}: {
  initialTab?: "login" | "register"
  onLogin: (user: AppUser) => void
}) {
  const [tab,       setTab]       = useState<"login" | "register">(initialTab)
  const [loading,   setLoading]   = useState(false)

  // Login fields
  const [lEmail,    setLEmail]    = useState("")
  const [lPassword, setLPassword] = useState("")

  // Register fields (shared)
  const [rName,     setRName]     = useState("")
  const [rEmail,    setREmail]    = useState("")
  const [rPassword, setRPassword] = useState("")
  const [rConfirm,  setRConfirm]  = useState("")

  // Role-specific register fields
  const [rRole,     setRRole]     = useState("member")            // new role selector state
  const [rOrg,      setROrg]      = useState("")                  // org-owner
  const [rTeam,     setRTeam]     = useState("UMRT")              // team-manager, subteam-manager, member
  const [rSubteam,  setRSubteam]  = useState("Software")          // subteam-manager, member
  const [rBatch,    setRBatch]    = useState("2024")              // member
  const [rWhatsapp, setRWhatsapp] = useState("")                  // member
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!lEmail.trim() || !lPassword.trim()) {
      setErrorMsg("Please enter your email and password.")
      return
    }

    setLoading(true)

    try {
      const user = await authApi.login(lEmail.trim(), lPassword.trim())
      onLogin({
        id: user.id,
        name: user.name,
        email: user.email,
        initials: user.initials,
        role: normalizeRole(user.role),
        team: user.team,
        subteam: user.subteam,
        batch: user.batch,
        whatsapp: user.whatsapp,
      })
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid email or password.")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!rName.trim() || !rEmail.trim() || !rPassword.trim()) {
      setErrorMsg("Please fill in all required fields.")
      return
    }

    if (rPassword !== rConfirm) {
      setErrorMsg("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("name", rName.trim())
      formData.append("email", rEmail.trim())
      formData.append("password", rPassword.trim())
      formData.append("role", rRole === "org-owner" ? "ORG_OWNER" : rRole === "team-manager" ? "TEAM_MANAGER" : rRole === "subteam-manager" ? "SUBTEAM_MANAGER" : "MEMBER")
      if (rTeam) formData.append("teamName", rTeam)
      if (rSubteam) formData.append("subteamNames", JSON.stringify([rSubteam]))
      if (rBatch) formData.append("batch", rBatch)
      if (rWhatsapp) formData.append("whatsapp", rWhatsapp.trim() || "880123456789")

      const user = await authApi.register(formData)
      onLogin({
        id: user.id,
        name: user.name,
        email: user.email,
        initials: user.initials,
        role: normalizeRole(user.role),
        team: user.team,
        subteam: user.subteam,
        batch: user.batch,
        whatsapp: user.whatsapp,
      })
    } catch (err: any) {
      setErrorMsg(err.message || "Registration failed. Email may already be registered.")
    } finally {
      setLoading(false)
    }
  }

  const TEAMS    = [
    { value: "UMRT",     label: "UMRT" },
    { value: "URRT",     label: "URRT" },
    { value: "Team XYZ", label: "Team XYZ" },
  ]
  const SUBTEAMS = [
    { value: "Software",      label: "Software" },
    { value: "Electrical",    label: "Electrical" },
    { value: "Mechanical",    label: "Mechanical" },
    { value: "Communication", label: "Communication" },
    { value: "Science",       label: "Science" },
    { value: "Media",         label: "Media" },
    { value: "UI/UX",         label: "UI/UX" },
  ]
  const BATCHES  = ["2020","2021","2022","2023","2024","2025","2026"].map(b => ({ value: b, label: `Batch ${b}` }))

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: BG_PAGE }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 700px 400px at 50% 45%, oklch(0.20 0.005 285 / 0.3) 0%, transparent 70%)",
      }} />

      <AuthCard>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-[12px] flex items-center justify-center"
              style={{ background: "oklch(0.98 0 0)", boxShadow: "0 4px 20px oklch(0 0 0 / 0.4)" }}
            >
              <Building2 size={22} style={{ color: "oklch(0.12 0.005 285)" }} />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">RoverBuddies</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Team Availability Management · CAIR Lab</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border text-[11px] font-mono mt-2 text-foreground">
                <Clock size={11} className="text-primary animate-pulse shrink-0" />
                <span className="font-semibold">{formatDhakaTime(now)}</span>
                <span className="text-muted-foreground">BST</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={v => setTab(v as "login" | "register")}>
            <TabsList className="w-full h-9" style={{ background: "oklch(0.09 0.003 285)" }}>
              <TabsTrigger value="login"    className="flex-1 text-xs">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="flex-1 text-xs">Register</TabsTrigger>
            </TabsList>

            {/* ── Login ── */}
            <TabsContent value="login" className="mt-5">
              <form onSubmit={handleLogin} className="space-y-4">
                <Field id="l-email"    label="Email"    type="email"    placeholder="name@cairlab.org" value={lEmail}    onChange={setLEmail} />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground" htmlFor="l-password">Password</label>
                    <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Forgot?</a>
                  </div>
                  <div className="relative">
                    <PasswordInput id="l-password" value={lPassword} onChange={setLPassword} />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium text-center">
                    {errorMsg}
                  </div>
                )}

                <Button type="submit" className="w-full h-10 text-sm font-semibold mt-1" disabled={loading}>
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" /> Signing in...</>
                    : "Sign In"
                  }
                </Button>
              </form>
            </TabsContent>

            {/* ── Register ── */}
            <TabsContent value="register" className="mt-5">
              <form onSubmit={handleRegister} className="space-y-3.5">
                <Field id="r-name"  label="Full Name"  placeholder="Your full name" value={rName}  onChange={setRName} />
                <Field id="r-email" label="Work Email" type="email" placeholder="name@cairlab.org" value={rEmail} onChange={setREmail} />

                {/* Role-specific extra fields */}
                <SelectField 
                  id="r-role" 
                  label="Role" 
                  value={rRole} 
                  onChange={setRRole} 
                  options={[
                    { value: "member", label: "Member" },
                    { value: "subteam-manager", label: "Subteam Manager" },
                    { value: "team-manager", label: "Team Manager" },
                    { value: "org-owner", label: "Organization Owner" },
                  ]} 
                />

                {rRole === "org-owner" && (
                  <Field id="r-org" label="Organization Name" placeholder="e.g. CAIR Lab" value={rOrg} onChange={setROrg} />
                )}
                {(rRole === "team-manager" || rRole === "subteam-manager" || rRole === "member") && (
                  <SelectField id="r-team" label="Team" value={rTeam} onChange={setRTeam} options={TEAMS} />
                )}
                {(rRole === "subteam-manager" || rRole === "member") && (
                  <SelectField id="r-sub" label="Subteam" value={rSubteam} onChange={setRSubteam} options={SUBTEAMS} />
                )}
                {rRole === "member" && (
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField id="r-batch"    label="Batch"    value={rBatch}    onChange={setRBatch}    options={BATCHES} />
                    <Field       id="r-whatsapp" label="WhatsApp" placeholder="880..." value={rWhatsapp} onChange={setRWhatsapp} />
                  </div>
                )}

                <Field id="r-pass"    label="Password"         type="password" value={rPassword} onChange={setRPassword} />
                <Field id="r-confirm" label="Confirm Password" type="password" value={rConfirm}  onChange={setRConfirm} />

                {rConfirm && rPassword !== rConfirm && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}

                {errorMsg && (
                  <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium text-center">
                    {errorMsg}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-semibold"
                  disabled={loading || (!!rConfirm && rPassword !== rConfirm)}
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" /> Creating account...</>
                    : "Create Account"
                  }
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </AuthCard>
    </div>
  )
}

// Standalone password input with show/hide toggle (avoids Field nesting issues)
function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 text-sm pr-9"
        style={{ background: BG_INPUT, borderColor: BORDER }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

// ─── Root AuthPage ─────────────────────────────────────────────────────────────

export function AuthPage({ 
  onLogin, 
  initialTab = "login" 
}: { 
  onLogin: (user: AppUser) => void;
  initialTab?: "login" | "register";
}) {
  return (
    <AuthForms
      initialTab={initialTab}
      onLogin={onLogin}
    />
  )
}

