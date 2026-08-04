import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Building2, Loader2, UploadCloud, CheckCircle2, ArrowLeft,
  Shield, Users, Layers, User, Eye, EyeOff,
} from "lucide-react"
import type { AppUser, UserRole } from "@/lib/user-context"
import { roleLabel } from "@/lib/user-context"

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
          required
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

// ─── Step 2 — Login & Register for a specific role ────────────────────────────

function AuthForms({
  roleCard,
  onBack,
  onLogin,
}: {
  roleCard: RoleCard
  onBack: () => void
  onLogin: (user: AppUser) => void
}) {
  const [tab,       setTab]       = useState<"login" | "register">("login")
  const [loading,   setLoading]   = useState(false)
  const [showDone,  setShowDone]  = useState(false)

  // Login fields
  const [lEmail,    setLEmail]    = useState("")
  const [lPassword, setLPassword] = useState("")

  // Register fields (shared)
  const [rName,     setRName]     = useState("")
  const [rEmail,    setREmail]    = useState("")
  const [rPassword, setRPassword] = useState("")
  const [rConfirm,  setRConfirm]  = useState("")

  // Role-specific register fields
  const [rOrg,      setROrg]      = useState("")                  // org-owner
  const [rTeam,     setRTeam]     = useState("UMRT")              // team-manager, subteam-manager, member
  const [rSubteam,  setRSubteam]  = useState("Software")          // subteam-manager, member
  const [rBatch,    setRBatch]    = useState("2024")              // member
  const [rWhatsapp, setRWhatsapp] = useState("")                  // member

  const role = roleCard.role

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onLogin(DEMO_BY_ROLE[role])
    }, 1100)
  }

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    if (rPassword !== rConfirm) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const initials = rName.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()
      const newUser: AppUser = {
        id:       "new-" + Date.now(),
        name:     rName,
        initials,
        email:    rEmail,
        role,
        team:     role === "org-owner" ? (rOrg || "CAIR Lab") : rTeam,
        subteam:  (role === "subteam-manager" || role === "member") ? rSubteam : "Software",
        batch:    role === "member" ? rBatch : "2024",
        whatsapp: rWhatsapp || "880100000000",
      }
      onLogin(newUser)
    }, 1100)
  }

  const TEAMS    = [
    { value: "UMRT",     label: "UMRT" },
    { value: "URRT",     label: "URRT" },
    { value: "Team XYZ", label: "Team XYZ" },
  ]
  const SUBTEAMS = [
    { value: "Software",   label: "Software" },
    { value: "Electrical", label: "Electrical" },
    { value: "Mechanical", label: "Mechanical" },
    { value: "UI/UX",      label: "UI/UX" },
  ]
  const BATCHES  = ["2020","2021","2022","2023","2024","2025"].map(b => ({ value: b, label: `Batch ${b}` }))

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: BG_PAGE }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 700px 400px at 50% 45%, oklch(0.20 0.005 285 / 0.3) 0%, transparent 70%)",
      }} />

      <AuthCard
        footer={
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <ArrowLeft size={12} /> Back to role selection
          </button>
        }
      >
        {/* Brand + role badge */}
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Role icon pill */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium"
              style={{
                borderColor: roleCard.accentVar + "44",
                background:  roleCard.accentVar + "12",
                color:        roleCard.accentVar,
              }}
            >
              {roleCard.icon}
              {roleCard.label}
            </div>

            <div
              className="w-12 h-12 rounded-[12px] flex items-center justify-center"
              style={{ background: "oklch(0.98 0 0)", boxShadow: "0 4px 20px oklch(0 0 0 / 0.4)" }}
            >
              <Building2 size={22} style={{ color: "oklch(0.12 0.005 285)" }} />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">RoverBuddies</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Team Availability Management · CAIR Lab</p>
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
                {role === "org-owner" && (
                  <Field id="r-org" label="Organization Name" placeholder="e.g. CAIR Lab" value={rOrg} onChange={setROrg} />
                )}
                {(role === "team-manager" || role === "subteam-manager" || role === "member") && (
                  <SelectField id="r-team" label="Team" value={rTeam} onChange={setRTeam} options={TEAMS} />
                )}
                {(role === "subteam-manager" || role === "member") && (
                  <SelectField id="r-sub" label="Subteam" value={rSubteam} onChange={setRSubteam} options={SUBTEAMS} />
                )}
                {role === "member" && (
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
        required
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

// ─── Onboarding modal (members only) ──────────────────────────────────────────

function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [drag,      setDrag]      = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [done,      setDone]      = useState(false)

  const startUpload = () => {
    setUploading(true)
    let p = 0
    const iv = setInterval(() => {
      p += 15
      if (p >= 100) { clearInterval(iv); setProgress(100); setTimeout(() => setDone(true), 400) }
      else setProgress(p)
    }, 200)
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Your Class Routine</DialogTitle>
          <DialogDescription>We need your UCAM schedule to sync your availability with the team.</DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="py-4">
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); startUpload() }}
              onClick={!uploading ? startUpload : undefined}
              className={[
                "border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200",
                drag ? "border-primary bg-primary/5 scale-[1.02]" : "border-border bg-muted/30 hover:bg-muted/50",
                uploading ? "pointer-events-none opacity-80" : "cursor-pointer",
              ].join(" ")}
            >
              {!uploading ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center mb-4">
                    <UploadCloud size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Click or drag your UCAM XLSX here</p>
                  <p className="text-xs text-muted-foreground">Courses, days, and times are parsed automatically</p>
                </>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                    <Loader2 size={24} className="text-primary animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">Parsing schedule data...</span>
                      <span className="font-mono text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <div>
              <p className="text-base font-semibold">Routine Synced Successfully</p>
              <p className="text-sm text-muted-foreground mt-1">18 classes and 4 labs detected.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {done
            ? <Button className="w-full" onClick={onComplete}>Go to Dashboard</Button>
            : <Button variant="ghost" className="w-full" onClick={onComplete} disabled={uploading}>Skip for now</Button>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Root AuthPage ─────────────────────────────────────────────────────────────

type AuthStep = "role-select" | "auth-forms" | "onboarding"

export function AuthPage({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [step,      setStep]      = useState<AuthStep>("role-select")
  const [roleCard,  setRoleCard]  = useState<RoleCard | null>(null)
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null)

  const handleRoleSelect = (role: UserRole) => {
    setRoleCard(ROLE_CARDS.find(c => c.role === role)!)
    setStep("auth-forms")
  }

  const handleAuthComplete = (user: AppUser) => {
    if (user.role === "member") {
      setPendingUser(user)
      setStep("onboarding")
    } else {
      onLogin(user)
    }
  }

  if (step === "role-select") {
    return <RoleSelector onSelect={handleRoleSelect} />
  }

  if (step === "auth-forms" && roleCard) {
    return (
      <AuthForms
        roleCard={roleCard}
        onBack={() => setStep("role-select")}
        onLogin={handleAuthComplete}
      />
    )
  }

  if (step === "onboarding" && pendingUser) {
    return <OnboardingModal onComplete={() => onLogin(pendingUser)} />
  }

  return null
}
