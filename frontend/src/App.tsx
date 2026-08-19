import { useState, useEffect, useRef, useMemo } from "react"
import {
  LayoutDashboard, Users, Search, BarChart3, Zap, Settings,
  ChevronRight, Bell, MessageCircle, Filter, TrendingUp,
  Shield, Calendar, LogOut, User, HelpCircle, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Minus, ArrowUpRight,
  Upload, Building2, ChevronDown, Lock, Layers, Plus, Pencil,
  Clock, AlertTriangle, Save, ArrowLeft, Menu, X, Eye, Loader2,
  Sparkles, Phone, Trash2
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UserContext, useUser, useUserCtx, canAccessPage, teamScope, subteamScope, roleLabel, normalizeRole } from "@/lib/user-context"
import type { AppUser, UserRole } from "@/lib/user-context"
import { AuthPage } from "./Auth"
import { AIChat } from "@/components/AIChat"
import { membersApi, heatmapApi, skillsApi, routinesApi, authApi, teamsApi, projectsApi } from "@/lib/api"
import { LandingPage } from "@/LandingPage"

// ─── Types ────────────────────────────────────────────────────────────────────

type AvailStatus = "free" | "in-class" | "soon" | "missing"
type NavPage = "dashboard" | "members" | "search" | "heatmap" | "skills" | "projects" | "meeting-planner" | "portfolio" | "settings"
type DayOfWeek = "Sat" | "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri"

interface ClassSlot {
  day: DayOfWeek
  startTime: string
  endTime: string
  course: string
  room?: string
}

interface Member {
  id: string; name: string; initials: string; org: string; team: string; subteams: string[]
  status: AvailStatus; nextChange: string; currentClass?: string; remainingMin?: number
  skills: string[]; batch: string; whatsapp: string; role: string
  schedule: ClassSlot[]
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const MEMBERS: Member[] = []

// ─── Permission defaults ──────────────────────────────────────────────────────

const DEFAULT_PAGE_PERMS: Record<string, string[]> = {
  "org-owner": ["dashboard", "members", "search", "heatmap", "skills", "projects", "meeting-planner", "portfolio", "settings"],
  "team-manager": ["dashboard", "members", "search", "heatmap", "skills", "projects", "meeting-planner", "portfolio", "settings"],
  "subteam-manager": ["dashboard", "members", "search", "heatmap", "skills", "projects", "meeting-planner", "portfolio", "settings"],
  "member": ["dashboard", "members", "search", "heatmap", "skills", "projects", "meeting-planner", "portfolio", "settings"],
}

const DEFAULT_FEATURE_PERMS: Record<string, string[]> = {
  "org-owner": ["Manage all teams", "Configure semesters", "View org analytics", "Assign/revoke roles", "Approve skills globally"],
  "team-manager": ["Manage team", "Create & manage subteams", "Assign Subteam Managers", "Approve member skills", "View team analytics"],
  "subteam-manager": ["Manage subteam", "Add/remove members", "Approve member skills", "View subteam schedules", "View subteam analytics"],
  "member": ["Upload class routine", "Update profile", "Request new skills", "View availability", "Search subteam members", "Contact teammates"],
}

const ALL_PAGE_OPTIONS: { id: string; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "members", label: "Members" },
  { id: "search", label: "Find Members" },
  { id: "heatmap", label: "Heatmap" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects & Kanban" },
  { id: "meeting-planner", label: "AI Scheduler" },
  { id: "portfolio", label: "Work History" },
  { id: "settings", label: "Settings" },
]

const ALL_FEATURE_OPTIONS: Record<string, string[]> = {
  "team-manager": ["Manage team", "Create & manage subteams", "Assign Subteam Managers", "Approve member skills", "View team analytics"],
  "subteam-manager": ["Manage subteam", "Add/remove members", "Approve member skills", "View subteam schedules", "View subteam analytics"],
  "member": ["Upload class routine", "Update profile", "Request new skills", "View availability", "Search subteam members", "Contact teammates"],
}

const PENDING_APPROVALS: any[] = []
const DAYS: DayOfWeek[] = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]
const DAY_INDEX_MAP: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] // JS getDay(): 0=Sun..6=Sat
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

function getDhakaTimeParts(date: Date = new Date()): {
  day: DayOfWeek
  hours: number
  minutes: number
  timeStr24: string
  totalMinutes: number
} {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date()

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
    const parts = formatter.formatToParts(d)
    let day: DayOfWeek = "Mon"
    let hours = 0
    let minutes = 0
    let isPM = false
    let isAM = false

    for (const p of parts) {
      if (p.type === "weekday") {
        day = p.value as DayOfWeek
      } else if (p.type === "hour") {
        hours = parseInt(p.value, 10)
      } else if (p.type === "minute") {
        minutes = parseInt(p.value, 10)
      } else if (p.type === "dayPeriod") {
        const val = p.value.toUpperCase()
        if (val === "PM") isPM = true
        if (val === "AM") isAM = true
      }
    }

    if (isPM && hours < 12) {
      hours += 12
    } else if (isAM && hours === 12) {
      hours = 0
    }
    if (hours === 24) {
      hours = 0
    }

    const timeStr24 = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    const totalMinutes = hours * 60 + minutes
    return { day, hours, minutes, timeStr24, totalMinutes }
  } catch {
    // Robust UTC + 6 hours fallback
    const days: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000)
    const dhakaTime = new Date(utcTime + (6 * 3600000))
    const day = days[dhakaTime.getDay()]
    const hours = dhakaTime.getHours()
    const minutes = dhakaTime.getMinutes()
    const timeStr24 = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    const totalMinutes = hours * 60 + minutes
    return { day, hours, minutes, timeStr24, totalMinutes }
  }
}

function getTodayDayOfWeek(): DayOfWeek {
  return getDhakaTimeParts().day
}

function formatDhakaTime24(date: Date = new Date()): string {
  try {
    return date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
  } catch {
    const parts = getDhakaTimeParts(date)
    return `${parts.timeStr24}:00`
  }
}

function formatDhakaTime12(date: Date = new Date()): string {
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

function formatDhakaTime(date: Date = new Date()): string {
  return `${formatDhakaTime24(date)} (${formatDhakaTime12(date)})`
}

function formatDhakaDate(date: Date = new Date()): string {
  try {
    return date.toLocaleDateString("en-US", {
      timeZone: "Asia/Dhaka",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  }
}

function formatDhakaDateTime(dateStrOrObj: string | Date): string {
  if (!dateStrOrObj) return ""
  try {
    const d = typeof dateStrOrObj === "string" ? new Date(dateStrOrObj) : dateStrOrObj
    return d.toLocaleString("en-US", {
      timeZone: "Asia/Dhaka",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  } catch {
    return String(dateStrOrObj)
  }
}

// ─── Availability helper ───────────────────────────────────────────────────────

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const clean = timeStr.trim()

  // Format 1: "02:00:PM" or "02:00:AM" (UIU format with colon before AM/PM)
  const matchColonAmPm = clean.match(/^(\d{1,2}):(\d{2}):(AM|PM)$/i)
  if (matchColonAmPm) {
    let h = parseInt(matchColonAmPm[1], 10)
    const m = parseInt(matchColonAmPm[2], 10)
    const isPM = matchColonAmPm[3].toUpperCase() === "PM"
    if (isPM && h !== 12) h += 12
    if (!isPM && h === 12) h = 0
    return h * 60 + m
  }

  // Format 2: "02:00 PM" or "2:00PM" or "02:00:00 PM" (Standard 12-hour AM/PM)
  const match12 = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (match12) {
    let h = parseInt(match12[1], 10)
    const m = parseInt(match12[2], 10)
    const isPM = match12[3].toUpperCase() === "PM"
    if (isPM && h !== 12) h += 12
    if (!isPM && h === 12) h = 0
    return h * 60 + m
  }

  // Format 3: Range string e.g. "14:00 - 16:30" (extract first time if passed)
  if (clean.includes("-") || clean.includes("–")) {
    const firstPart = clean.split(/[-–]/)[0].trim()
    return timeToMinutes(firstPart)
  }

  // Format 4: 24-hour "HH:mm" or "HH:mm:ss"
  const parts = clean.split(":").map(Number)
  const h = parts[0] || 0
  const m = parts[1] || 0
  return h * 60 + m
}

function format12Hour(timeStr: string): string {
  if (!timeStr) return ""
  const mins = timeToMinutes(timeStr)
  let h = Math.floor(mins / 60)
  const m = mins % 60
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12
  h = h ? h : 12
  const minuteDisplay = m < 10 ? `0${m}` : m
  return `${h}:${minuteDisplay} ${ampm}`
}

function computeLiveAvailability(
  schedule: ClassSlot[],
  overrideDay?: DayOfWeek,
  overrideTimeStr?: string
): {
  status: AvailStatus
  nextChange: string
  currentClass?: string
  remainingMin?: number
} {
  if (!schedule || schedule.length === 0) {
    return {
      status: "missing",
      nextChange: "Routine not uploaded",
    }
  }

  const dhakaNow = getDhakaTimeParts()
  const targetDay = overrideDay || dhakaNow.day
  const currentMins = overrideTimeStr ? timeToMinutes(overrideTimeStr) : dhakaNow.totalMinutes

  const todayClasses = schedule.filter(s => s.day === targetDay)
  if (todayClasses.length === 0) {
    return {
      status: "free",
      nextChange: "Free all day",
    }
  }

  // 1. Check if currently in class
  for (const slot of todayClasses) {
    const startMins = timeToMinutes(slot.startTime)
    const endMins = timeToMinutes(slot.endTime)

    if (currentMins >= startMins && currentMins < endMins) {
      const remainingMin = endMins - currentMins
      return {
        status: "in-class",
        nextChange: `Free at ${format12Hour(slot.endTime)}`,
        currentClass: slot.course,
        remainingMin,
      }
    }
  }

  // 2. Check if class starting soon (within 30 mins)
  const upcoming = todayClasses
    .map(slot => ({ slot, startMins: timeToMinutes(slot.startTime) }))
    .filter(x => x.startMins > currentMins)
    .sort((a, b) => a.startMins - b.startMins)

  if (upcoming.length > 0) {
    const next = upcoming[0]
    const diff = next.startMins - currentMins
    if (diff <= 30) {
      return {
        status: "soon",
        nextChange: `Class in ${diff} min`,
        currentClass: next.slot.course,
      }
    }
    return {
      status: "free",
      nextChange: `Free until ${format12Hour(next.slot.startTime)}`,
    }
  }

  return {
    status: "free",
    nextChange: "Free rest of the day",
  }
}

function enrichMemberWithLiveStatus(m: Member): Member {
  const live = computeLiveAvailability(m.schedule)
  return {
    ...m,
    status: live.status,
    nextChange: live.nextChange,
    currentClass: live.currentClass,
    remainingMin: live.remainingMin,
  }
}

function isFreeAt(member: Member, day: DayOfWeek, time: string): boolean {
  if (!member.schedule || member.schedule.length === 0) return false
  const tMin = timeToMinutes(time)
  return !member.schedule.some(slot => {
    if (slot.day !== day) return false
    const startMins = timeToMinutes(slot.startTime)
    const endMins = timeToMinutes(slot.endTime)
    return tMin >= startMins && tMin < endMins
  })
}

function isFreeDuringInterval(
  schedule: ClassSlot[],
  day: DayOfWeek,
  startTimeStr: string,
  endTimeStr: string
): { isFree: boolean; conflictCourse?: string } {
  if (!schedule || schedule.length === 0) return { isFree: false }
  const startMins = timeToMinutes(startTimeStr)
  const endMins = timeToMinutes(endTimeStr)

  for (const slot of schedule) {
    if (slot.day !== day) continue
    const slotStart = timeToMinutes(slot.startTime)
    const slotEnd = timeToMinutes(slot.endTime)

    if (startMins < slotEnd && endMins > slotStart) {
      return { isFree: false, conflictCourse: slot.course }
    }
  }
  return { isFree: true }
}

// ─── Status helpers ────────────────────────────────────────────────────────────

type BadgeVariant = "success" | "destructive" | "warning" | "muted"

function statusMeta(s: AvailStatus): { dotClass: string; label: string; variant: BadgeVariant; icon: React.ReactNode } {
  const map = {
    free: { dotClass: "bg-success", label: "Free", variant: "success" as BadgeVariant, icon: <CheckCircle2 size={11} /> },
    "in-class": { dotClass: "bg-destructive", label: "In Class", variant: "destructive" as BadgeVariant, icon: <XCircle size={11} /> },
    soon: { dotClass: "bg-warning", label: "Class Soon", variant: "warning" as BadgeVariant, icon: <AlertCircle size={11} /> },
    missing: { dotClass: "bg-muted-foreground", label: "No Routine", variant: "muted" as BadgeVariant, icon: <Minus size={11} /> },
  }
  return map[s]
}

function StatusBadge({ status }: { status: AvailStatus }) {
  const { label, variant, icon } = statusMeta(status)
  return <Badge variant={variant}>{icon}{label}</Badge>
}

function MemberAvatar({ member, size = "md" }: { member: Member; size?: "sm" | "md" | "lg" }) {
  const { dotClass } = statusMeta(member.status)
  const dim = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-10 h-10" : "w-8 h-8"
  const dot = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5"
  return (
    <div className="relative shrink-0">
      <Avatar className={dim}>
        <AvatarFallback className="text-xs bg-accent text-accent-foreground font-medium">{member.initials}</AvatarFallback>
      </Avatar>
      <span className={cn("absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-card", dot, dotClass)} />
    </div>
  )
}

function heatBadgeVariant(ratio: number): BadgeVariant {
  if (ratio >= 0.75) return "success"
  if (ratio >= 0.5) return "warning"
  return "destructive"
}

// ─── Access denied ────────────────────────────────────────────────────────────

function AccessDenied({ requiredRole }: { requiredRole?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-5">
        <Lock size={28} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Access Restricted</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        You don't have permission to view this page.
        {requiredRole && <> Requires <span className="font-medium text-foreground">{requiredRole}</span> or higher.</>}
      </p>
    </div>
  )
}

// ─── Routine restriction banner ────────────────────────────────────────────────

function RoutineRestrictionBanner({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
        <AlertTriangle size={20} className="text-warning" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">Routine Upload Required</p>
        <p className="text-xs text-muted-foreground mt-1">
          The semester upload deadline has passed. You must upload your current class routine to use the platform.
          Your availability is currently shown as <span className="font-medium text-muted-foreground">No Routine</span> to all team members.
        </p>
        <Button size="sm" className="gap-1.5 mt-3" onClick={onUpload}>
          <Upload size={13} /> Upload Routine Now
        </Button>
      </div>
    </div>
  )
}

// ─── WhatsApp missing banner and popup modal ───────────────────────────────────

function WhatsAppMissingBanner({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
          <MessageCircle size={22} className="animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">Action Required: Add Your WhatsApp Number</p>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500 font-mono">Missing</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Teammates in CAIR Lab need your WhatsApp contact for one-click quick messaging, task coordination, and meeting alerts.
          </p>
        </div>
      </div>
      <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 font-semibold shadow-sm" onClick={onOpenModal}>
        <MessageCircle size={14} /> Add WhatsApp Number
      </Button>
    </div>
  )
}

function WhatsAppPromptDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user, updateUser } = useUserCtx()
  const [number, setNumber] = useState(user.whatsapp === "880123456789" ? "" : user.whatsapp || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNumber(user.whatsapp === "880123456789" ? "" : user.whatsapp || "")
      setError(null)
      setSuccess(null)
    }
  }, [open, user.whatsapp])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = number.trim().replace(/\s+/g, "")
    if (!clean || clean.length < 8) {
      setError("Please enter a valid WhatsApp phone number (e.g. 01712345678 or +8801712345678)")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await authApi.updateProfile({ whatsapp: clean })
      updateUser({ whatsapp: updated.whatsapp || clean })
      setSuccess("WhatsApp number saved successfully!")
      setTimeout(() => {
        onOpenChange(false)
      }, 1000)
    } catch (err: any) {
      setError(err?.message || "Failed to update WhatsApp number. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-1">
            <MessageCircle size={26} />
          </div>
          <DialogTitle className="text-lg font-bold">Add Your WhatsApp Number</DialogTitle>
          <DialogDescription className="text-xs">
            Connect your active WhatsApp number so teammates in CAIR Lab can contact you directly for project tasks, updates, and schedule sync.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 size={14} /> {success}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">WhatsApp Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="e.g. 01712345678 or +8801712345678"
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="pl-9 font-mono text-sm"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used strictly within CAIR Lab member cards for direct 1-click WhatsApp messaging.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                sessionStorage.setItem("dismissed_whatsapp_prompt", "true")
                onOpenChange(false)
              }}
            >
              Remind Me Later
            </Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium">
              {saving ? "Saving..." : "Save WhatsApp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const ALL_NAV: { id: NavPage; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
  { id: "members", label: "Members", icon: <Users size={15} /> },
  { id: "search", label: "Find Members", icon: <Search size={15} /> },
  { id: "heatmap", label: "Heatmap", icon: <BarChart3 size={15} /> },
  { id: "skills", label: "Skills Catalog", icon: <Zap size={15} /> },
  { id: "projects", label: "Projects & Kanban", icon: <Layers size={15} /> },
  { id: "meeting-planner", label: "AI Scheduler", icon: <Calendar size={15} /> },
  { id: "portfolio", label: "Work History", icon: <User size={15} /> },
  { id: "settings", label: "Settings", icon: <Settings size={15} /> },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }: {
  page: NavPage;
  setPage: (p: NavPage) => void;
  mobileOpen: boolean;
  setMobileOpen: (o: boolean) => void;
}) {
  const { user, pagePerms } = useUserCtx()
  const nav = ALL_NAV.filter(n => (pagePerms[user.role] ?? []).includes(n.id))

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 flex flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 size={13} className="text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground leading-none">RoverBuddies</p>
              <p className="text-[10px] font-mono text-sidebar-muted-foreground mt-0.5">CAIR Lab</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setMobileOpen(false)}>
            <X size={15} />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav className="px-3 space-y-0.5">
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
              Navigation
            </p>
            {nav.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => {
                  setPage(id)
                  setMobileOpen(false)
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors text-left",
                  page === id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-muted hover:text-sidebar-foreground"
                )}
              >
                {icon} {label}
              </button>
            ))}
          </nav>

          <div className="px-3 mt-4">
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">Your Scope</p>
            <div className="px-2 space-y-1 text-xs text-sidebar-muted-foreground">
              {user.role === "org-owner"
                ? <div className="flex items-center gap-1.5"><Shield size={10} />All teams</div>
                : <div className="flex items-center gap-1.5"><Shield size={10} />{user.team}</div>
              }
              {(user.role === "subteam-manager" || user.role === "member") && (
                <div className="flex items-center gap-1.5"><Layers size={10} />{user.subteam}</div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-3 pb-4 shrink-0">
          <div className="rounded-lg bg-sidebar-muted border border-sidebar-border p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar size={11} className="text-sidebar-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-sidebar-muted-foreground">Semester</span>
            </div>
            <p className="text-sm font-semibold text-sidebar-foreground">Fall 2026</p>
            <div className="mt-2.5 space-y-1">
              <div className="flex justify-between text-[10px] text-sidebar-muted-foreground">
                <span>Upload deadline</span><span>Sep 10</span>
              </div>
              <Progress value={62} className="h-1 bg-sidebar-border" indicatorClassName="bg-primary" />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Dhaka Clock Widget ───────────────────────────────────────────────────────

function DhakaClockWidget() {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-xs font-mono select-none">
      <div className="flex items-center gap-1 sm:gap-1.5 text-primary">
        <Clock size={12} className="text-primary animate-pulse shrink-0" />
        <span className="font-semibold text-foreground tracking-tight text-[11px] sm:text-xs">{formatDhakaTime(now)}</span>
      </div>
      <span className="text-muted-foreground/40 hidden md:inline">|</span>
      <span className="text-muted-foreground text-[11px] hidden md:inline">{formatDhakaDate(now)}</span>
      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/30 text-primary font-semibold hidden lg:inline-flex">
        BST (UTC+6)
      </Badge>
    </div>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ page, onSignOut, onOpenProfile, onToggleMobileMenu }: {
  page: NavPage; onSignOut: () => void; onOpenProfile: () => void; onToggleMobileMenu: () => void
}) {
  const user = useUser()
  const label = ALL_NAV.find(n => n.id === page)?.label

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center gap-2 px-4 sm:px-6 border-b bg-card/80 backdrop-blur-md">
      <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden mr-1" onClick={onToggleMobileMenu}>
        <Menu size={18} />
      </Button>
      <span className="text-xs text-muted-foreground hidden sm:inline">CAIR Lab</span>
      <ChevronRight size={12} className="text-muted-foreground hidden sm:inline" />
      <span className="text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-none">{label}</span>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <DhakaClockWidget />
        <Badge variant="success" className="gap-1.5 text-[11px] px-2 hidden sm:inline-flex">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
          <span>Live</span>
        </Badge>
        <Separator orientation="vertical" className="h-5 mx-0.5 sm:mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8"><Bell size={15} /></Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-8 px-1.5 sm:px-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{user.initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{user.name}</span>
              <ChevronDown size={13} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{roleLabel(user.role)}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenProfile}><User size={14} />My Profile</DropdownMenuItem>
            <DropdownMenuItem><HelpCircle size={14} />Help</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onSignOut}>
              <LogOut size={14} />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ─── Profile Edit Dialog ──────────────────────────────────────────────────────

// ─── Profile Edit Dialog ──────────────────────────────────────────────────────

function ProfileEditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, updateUser } = useUserCtx()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [whatsapp, setWhatsapp] = useState(user.whatsapp)
  const [team, setTeam] = useState(user.team || "UMRT")
  const [subteam, setSubteam] = useState(user.subteam || "Software")
  const [batch, setBatch] = useState(user.batch || "2024")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Synchronize fields when modal opens or user updates
  useEffect(() => {
    if (open) {
      setName(user.name)
      setEmail(user.email)
      setWhatsapp(user.whatsapp)
      setTeam(user.team || "UMRT")
      setSubteam(user.subteam || "Software")
      setBatch(user.batch || "2024")
      setError(null)
      setSaved(false)
    }
  }, [open, user])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const updated = await authApi.updateProfile({
        name: name.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        batch,
        team,
        subteam,
      })

      updateUser({
        name: updated.name,
        email: updated.email,
        whatsapp: updated.whatsapp,
        batch: updated.batch,
        team: updated.team,
        subteam: updated.subteam,
        initials: updated.initials,
      })

      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onOpenChange(false)
      }, 1000)
    } catch (err: any) {
      setError(err.message || "Failed to update profile in database.")
    } finally {
      setLoading(false)
    }
  }

  const TEAMS_LIST = ["UMRT", "URRT", "Team XYZ"]
  const SUBTEAMS_LIST = ["Software", "Electrical", "Mechanical", "Communication", "Science", "Media", "UI/UX"]
  const BATCHES_LIST = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your personal details. Changes are saved directly to the database.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {/* User summary header */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-secondary/50 border border-border">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="text-base bg-primary text-primary-foreground font-semibold">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <Badge variant="outline" className="text-[10px] shrink-0 font-medium">
                  {roleLabel(user.role)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                <Lock size={10} /> Role is fixed ({roleLabel(user.role)}) and cannot be modified self-service.
              </p>
            </div>
          </div>

          {/* Editable fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Full Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Work Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@cairlab.org"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">WhatsApp Number</label>
              <Input
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="8801..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Batch</label>
              <Select value={batch} onValueChange={setBatch}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {BATCHES_LIST.map(b => (
                    <SelectItem key={b} value={b} className="text-xs">Batch {b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Team</label>
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS_LIST.map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Subteam</label>
              <Select value={subteam} onValueChange={setSubteam}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select subteam" />
                </SelectTrigger>
                <SelectContent>
                  {SUBTEAMS_LIST.map(st => (
                    <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium">
              {error}
            </div>
          )}

          {saved && (
            <div className="p-2.5 rounded-lg border border-success/30 bg-success/10 text-success text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Profile updated in database successfully!
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || saved} className="gap-1.5">
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : saved ? (
                <><CheckCircle2 size={14} /> Saved</>
              ) : (
                <><Save size={14} /> Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, variant }: {
  label: string; value: number; sub: string; icon: React.ReactNode
  variant: "success" | "destructive" | "warning" | "muted"
}) {
  const colorMap = {
    success: { text: "text-success", indicator: "bg-success" },
    destructive: { text: "text-destructive", indicator: "bg-destructive" },
    warning: { text: "text-warning", indicator: "bg-warning" },
    muted: { text: "text-muted-foreground", indicator: "bg-muted-foreground" },
  }
  const { text, indicator } = colorMap[variant]
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <span className={text}>{icon}</span>
          </div>
        </div>
        <p className={cn("text-3xl font-bold font-mono", text)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        <Progress value={(value / Math.max(MEMBERS.length, 1)) * 100} className="h-1 mt-3 bg-secondary" indicatorClassName={indicator} />
      </CardContent>
    </Card>
  )
}

function PendingApprovals() {
  const user = useUser()
  const [pendingSkills, setPendingSkills] = useState<any[]>([])
  const [pendingRoles, setPendingRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadPending = async () => {
    try {
      setLoading(true)
      const [skills, roles] = await Promise.all([
        skillsApi.getPendingSkills(),
        membersApi.getPendingRoles(),
      ])
      setPendingSkills(skills || [])
      setPendingRoles(roles || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
  }, [])

  if (user.role === "member") return null
  if (!loading && pendingSkills.length === 0 && pendingRoles.length === 0) return null

  const handleRoleAction = async (id: string, action: "approve" | "reject") => {
    try {
      await membersApi.updateRole(id, action)
      loadPending()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSkillAction = async (id: string, action: "approve" | "reject") => {
    try {
      if (action === "approve") await skillsApi.approveSkill(id)
      else await skillsApi.rejectSkill(id)
      loadPending()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Card className="border-warning/30 shadow-[0_4px_12px_oklch(var(--warning)/0.05)]">
      <CardHeader className="pb-3 border-b bg-warning/5 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle size={16} className="text-warning" />
              Pending Approvals
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Requires your review ({pendingRoles.length + pendingSkills.length} pending)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-60">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="h-8 text-[10px] pl-4">Member</TableHead>
                <TableHead className="h-8 text-[10px]">Type</TableHead>
                <TableHead className="h-8 text-[10px]">Request</TableHead>
                <TableHead className="h-8 text-[10px] text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRoles.map(r => (
                <TableRow key={`role-${r.id}`}>
                  <TableCell className="pl-4 py-2 text-xs font-medium">{r.name}</TableCell>
                  <TableCell className="py-2"><Badge variant="outline" className="text-[9px]">Role Change</Badge></TableCell>
                  <TableCell className="py-2 text-xs">Requested <span className="font-semibold text-primary">{roleLabel(r.requestedRole)}</span></TableCell>
                  <TableCell className="py-2 text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-success hover:text-success hover:bg-success/10" onClick={() => handleRoleAction(r.id, "approve")}><CheckCircle2 size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRoleAction(r.id, "reject")}><XCircle size={13} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pendingSkills.map(s => (
                <TableRow key={`skill-${s.id}`}>
                  <TableCell className="pl-4 py-2 text-xs font-medium">{s.memberName}</TableCell>
                  <TableCell className="py-2"><Badge variant="outline" className="text-[9px]">Skill</Badge></TableCell>
                  <TableCell className="py-2 text-xs">Requested <span className="font-semibold text-primary">{s.skillName}</span></TableCell>
                  <TableCell className="py-2 text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-success hover:text-success hover:bg-success/10" onClick={() => handleSkillAction(s.id, "approve")}><CheckCircle2 size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleSkillAction(s.id, "reject")}><XCircle size={13} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Loading...</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function getGreeting(date: Date = new Date()): string {
  const h = getDhakaTimeParts(date).hours
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  if (h < 21) return "Good evening"
  return "Good night"
}

function DashboardPage({ onUploadRoutine }: { onUploadRoutine: () => void }) {
  const user = useUser()
  const tScope = teamScope(user)
  const stScope = subteamScope(user)
  const [membersList, setMembersList] = useState<Member[]>([])
  const [dhakaNow, setDhakaNow] = useState<Date>(new Date())

  const loadData = () => {
    membersApi.getMembers()
      .then(res => setMembersList((res || []).map(enrichMemberWithLiveStatus)))
      .catch(() => setMembersList([]))
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(() => {
      setMembersList(prev => prev.map(enrichMemberWithLiveStatus))
    }, 15000)
    const clockTimer = setInterval(() => {
      setDhakaNow(new Date())
    }, 1000)
    return () => {
      clearInterval(timer)
      clearInterval(clockTimer)
    }
  }, [])

  const pool = membersList.filter(m => {
    if (tScope && m.team !== tScope) return false
    if (stScope && !m.subteams.includes(stScope)) return false
    return true
  })

  const [tab, setTab] = useState<AvailStatus | "all">("all")
  const [selected, setSelected] = useState<Member | null>(null)
  const canManage = user.role === "org-owner" || user.role === "team-manager" || user.role === "subteam-manager"
  const free = pool.filter(m => m.status === "free").length
  const inClass = pool.filter(m => m.status === "in-class").length
  const soon = pool.filter(m => m.status === "soon").length
  const missing = pool.filter(m => m.status === "missing").length
  const shown = tab === "all" ? pool : pool.filter(m => m.status === tab)

  const subteams = [...new Set(pool.flatMap(m => m.subteams))]

  // For "becoming free next" — in-class members sorted by least remaining time
  const becomingFree = pool.filter(m => m.status === "in-class" && m.remainingMin !== undefined)
    .sort((a, b) => (a.remainingMin ?? 99) - (b.remainingMin ?? 99))

  const isMemberMissing = user.role === "member" && pool.find(m => m.name === user.name)?.status === "missing"
  const isWhatsAppMissing = !user.whatsapp || !user.whatsapp.trim() || user.whatsapp === "880123456789" || user.whatsapp === "0123456789" || user.whatsapp.length < 9
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)

  // Auto popup on dashboard mount if WhatsApp is missing and not dismissed in this session
  useEffect(() => {
    if (isWhatsAppMissing) {
      const dismissed = sessionStorage.getItem("dismissed_whatsapp_prompt")
      if (!dismissed) {
        const t = setTimeout(() => {
          setWhatsAppModalOpen(true)
        }, 500)
        return () => clearTimeout(t)
      }
    }
  }, [isWhatsAppMissing])

  return (
    <div className="space-y-5">
      {/* Top Banner & Auto-Popup if WhatsApp Number is Missing */}
      {isWhatsAppMissing && (
        <WhatsAppMissingBanner onOpenModal={() => setWhatsAppModalOpen(true)} />
      )}
      <WhatsAppPromptDialog open={whatsAppModalOpen} onOpenChange={setWhatsAppModalOpen} />

      {isMemberMissing && <RoutineRestrictionBanner onUpload={onUploadRoutine} />}

      {/* Dashboard Live Hero Clock Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-card via-card/90 to-primary/5 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {getGreeting(dhakaNow)}, {user.name.split(" ")[0]}
            </h1>
            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse shrink-0" title="Real-time Live Sync" />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {tScope ?? "CAIR Lab"}{stScope ? ` · ${stScope}` : ""} · University Real-Time Class Availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Prominent Live Dhaka Clock Card */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-background/80 backdrop-blur-md border border-primary/20 font-mono shadow-sm">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Clock size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight font-mono">
                  {formatDhakaTime24(dhakaNow)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  ({formatDhakaTime12(dhakaNow)})
                </span>
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                  BST (UTC+6)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                {formatDhakaDate(dhakaNow)}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5 h-11 px-3.5" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      <PendingApprovals />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Free Now" value={free} sub={`${Math.round((free / Math.max(pool.length, 1)) * 100)}% of scope`} icon={<CheckCircle2 size={16} />} variant="success" />
        <StatCard label="In Class" value={inClass} sub="Currently unavailable" icon={<XCircle size={16} />} variant="destructive" />
        <StatCard label="Class Soon" value={soon} sub="Free within 30 min" icon={<AlertCircle size={16} />} variant="warning" />
        <StatCard label="No Routine" value={missing} sub="Action required" icon={<Shield size={16} />} variant="muted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Live table */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Live Availability
                  <Badge variant="secondary" className="text-[11px] font-mono px-2">{shown.length}/{pool.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">Live at {formatDhakaTime(dhakaNow)} BST · click a member to view details</CardDescription>
              </div>
              <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2.5">All</TabsTrigger>
                  <TabsTrigger value="free" className="text-xs px-2.5">Free</TabsTrigger>
                  <TabsTrigger value="in-class" className="text-xs px-2.5">Busy</TabsTrigger>
                  <TabsTrigger value="soon" className="text-xs px-2.5">Soon</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-0">
            <ScrollArea className="h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Member</TableHead>
                    <TableHead>Subteam</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="font-mono text-[11px]">Next Change</TableHead>
                    <TableHead className="font-mono text-[11px]">Remaining</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                        No member availability data yet. Upload class routines or register team members to populate real data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    shown.map(m => (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelected(m)}
                      >
                        <TableCell className="pl-3">
                          <div className="flex items-center gap-2.5">
                            <MemberAvatar member={m} size="sm" />
                            <span className="text-sm font-medium hover:underline">{m.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.subteams[0]}</TableCell>
                        <TableCell><StatusBadge status={m.status} /></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.nextChange}</TableCell>
                        <TableCell>
                          {m.status === "in-class" && m.remainingMin !== undefined
                            ? <span className="text-xs font-mono text-destructive flex items-center gap-1"><Clock size={10} />{m.remainingMin}m left</span>
                            : <span className="text-xs text-muted-foreground/40">—</span>
                          }
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                                <a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noreferrer">
                                  <MessageCircle size={13} />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>WhatsApp {m.name}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* AI Time-Availability Prediction Card */}
          {pool.length > 0 && (() => {
            const today = getTodayDayOfWeek()
            const daysArr: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            const tomIdx = (daysArr.indexOf(today) + 1) % 7
            const tomDay = daysArr[tomIdx]

            // Find today's peak hour
            let todayPeak = { hour: "14:00", free: 0 }
            HOURS.forEach(h => {
              const freeCount = pool.filter(m => isFreeAt(m, today, h)).length
              if (freeCount > todayPeak.free) todayPeak = { hour: h, free: freeCount }
            })

            // Find tomorrow's peak hour
            let tomPeak = { hour: "11:00", free: 0 }
            HOURS.forEach(h => {
              const freeCount = pool.filter(m => isFreeAt(m, tomDay, h)).length
              if (freeCount > tomPeak.free) tomPeak = { hour: h, free: freeCount }
            })

            const todayPct = Math.round((todayPeak.free / Math.max(pool.length, 1)) * 100)
            const tomPct = Math.round((tomPeak.free / Math.max(pool.length, 1)) * 100)

            return (
              <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-1.5 font-bold">
                      <Zap size={14} className="text-primary animate-pulse" /> AI Availability Prediction
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                      Dhaka BST
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">Predictive attendance windows from class routines</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-success/10 border border-success/20 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-success">Today&#39;s Peak Window ({today})</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{format12Hour(todayPeak.hour)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="success" className="font-mono text-xs">{todayPct}% Free</Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{todayPeak.free}/{pool.length} members</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tomorrow&#39;s Peak ({tomDay})</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{format12Hour(tomPeak.hour)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="font-mono text-xs">{tomPct}% Free</Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{tomPeak.free}/{pool.length} members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Becoming free next */}
          {becomingFree.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock size={13} className="text-warning" /> Becoming Free Next
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {becomingFree.slice(0, 3).map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelected(m)}
                  >
                    <MemberAvatar member={m} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate hover:underline">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.nextChange}</p>
                    </div>
                    <span className="text-[10px] font-mono text-warning shrink-0">{m.remainingMin}m</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Bar chart — computed from live members data */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Today&#39;s Availability ({getTodayDayOfWeek()})</CardTitle>
              <CardDescription className="text-xs">Members free per hour · Dhaka Time (BST)</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {pool.length === 0 ? (
                <div className="h-20 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No members yet</p>
                </div>
              ) : (() => {
                const today = getTodayDayOfWeek()
                const chartSlots = HOURS.map(h => {
                  const freeCount = pool.filter(m => isFreeAt(m, today, h)).length
                  return { t: h, v: freeCount }
                })
                const maxV = Math.max(...chartSlots.map(s => s.v), 1)
                const nowH = `${getDhakaTimeParts().hours.toString().padStart(2, "0")}:00`
                return (
                  <div className="flex items-end gap-1 h-20">
                    {chartSlots.map(s => {
                      const pct = s.v / maxV
                      const isNow = s.t === nowH
                      const barClass = isNow ? "bg-primary"
                        : pct > 0.7 ? "bg-success/60" : pct > 0.4 ? "bg-warning/60" : "bg-destructive/60"
                      return (
                        <Tooltip key={s.t}>
                          <TooltipTrigger asChild>
                            <div className="flex-1 flex flex-col items-center gap-1 cursor-default">
                              <div className={cn("w-full rounded-t-sm transition-all", barClass, !isNow && "opacity-70 hover:opacity-100")}
                                style={{ height: `${Math.max(pct * 76, 2)}px` }} />
                              <span className={cn("text-[9px] font-mono", isNow ? "text-primary font-bold" : "text-muted-foreground")}>
                                {s.t.slice(0, 2)}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{s.v}/{pool.length} free at {format12Hour(s.t)}</TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* By subteam */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">By Subteam</CardTitle>
              <CardDescription className="text-xs">Members free right now</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {subteams.map(sub => {
                const total = pool.filter(m => m.subteams.includes(sub)).length
                const freeNow = pool.filter(m => m.subteams.includes(sub) && m.status === "free").length
                if (!total) return null
                const pct = Math.round((freeNow / total) * 100)
                return (
                  <div key={sub}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground">{sub}</span>
                      <span className="text-muted-foreground font-mono">{freeNow}/{total} · {pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5 bg-secondary" indicatorClassName="bg-success" />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <MemberDialog
        member={selected}
        open={!!selected}
        onOpenChange={o => !o && setSelected(null)}
        canManage={canManage}
      />
    </div>
  )
}

// ─── Member Profile Dialog ────────────────────────────────────────────────────

function MemberDialog({ member, open, onOpenChange, canManage }: {
  member: Member | null; open: boolean; onOpenChange: (o: boolean) => void; canManage: boolean
}) {
  if (!member) return null
  const liveMember = enrichMemberWithLiveStatus(member)
  const todayDay = getTodayDayOfWeek()
  const todaySlots = liveMember.schedule.filter(s => s.day === todayDay)

  const [memberTasks, setMemberTasks] = useState<any[]>([])
  const [memberProjects, setMemberProjects] = useState<any[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  useEffect(() => {
    if (open && member) {
      setLoadingTasks(true)
      Promise.allSettled([
        projectsApi.getProjects(),
        projectsApi.getAllTasks(),
      ]).then(([projRes, taskRes]) => {
        const projs = projRes.status === "fulfilled" && projRes.value ? projRes.value : []
        const ts = taskRes.status === "fulfilled" && taskRes.value ? taskRes.value : []
        setMemberProjects(projs)
        const assigned = ts.filter((t: any) => {
          if (t.assigneeId && t.assigneeId === member.id) return true
          const label = (t.assigneeLabel || "").toLowerCase()
          const mName = (member.name || "").toLowerCase()
          const mInit = (member.initials || "").toLowerCase()
          return (mName && label.includes(mName)) || (mInit && label === mInit)
        })
        setMemberTasks(assigned)
      }).finally(() => setLoadingTasks(false))
    }
  }, [open, member?.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <MemberAvatar member={liveMember} size="lg" />
            <div>
              <p>{liveMember.name}</p>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                {liveMember.role} · {liveMember.org} · {liveMember.team}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Key info grid */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "Status", node: <StatusBadge status={liveMember.status} /> },
              { label: "Batch", node: <span className="text-sm font-mono text-foreground">{liveMember.batch}</span> },
              { label: "Next", node: <span className="text-sm font-mono text-foreground">{liveMember.nextChange}</span> },
              { label: "Org", node: <span className="text-sm text-foreground">{liveMember.org}</span> },
              { label: "Team", node: <span className="text-sm text-foreground">{liveMember.team}</span> },
              {
                label: "Subteam(s)", node:
                  <div className="flex flex-wrap gap-1">
                    {liveMember.subteams.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                  </div>
              },
            ] as { label: string; node: React.ReactNode }[]).map(r => (
              <div key={r.label} className="p-2.5 rounded-lg bg-muted">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{r.label}</p>
                {r.node}
              </div>
            ))}
          </div>

          {/* Remaining duration for in-class */}
          {liveMember.status === "in-class" && liveMember.remainingMin !== undefined && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <Clock size={14} className="text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">In {liveMember.currentClass}</p>
                <Progress value={((90 - liveMember.remainingMin) / 90) * 100} className="h-1 mt-1.5 bg-destructive/20" indicatorClassName="bg-destructive" />
              </div>
              <span className="text-xs font-mono text-destructive">{liveMember.remainingMin}m left</span>
            </div>
          )}

          {/* Contribution History (Projects & Kanban Board verified assignments) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contribution History</p>
              <span className="text-[10px] text-muted-foreground font-mono">Projects & Kanban Board</span>
            </div>
            {loadingTasks ? (
              <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground animate-pulse">Loading contributions...</div>
            ) : memberTasks.length === 0 ? (
              <div className="p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground">
                No active tasks assigned yet from Projects & Kanban Board.
              </div>
            ) : (
              <div className="space-y-2">
                {memberTasks.map((t, idx) => {
                  const proj = memberProjects.find(p => p.id === t.projectId)
                  const isDone = t.status === "Completed"
                  const isInProgress = t.status === "In Progress"
                  return (
                    <div key={t.id || idx} className="p-3 rounded-xl bg-muted border border-border space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj?.color || "#6366f1" }} />
                          <p className="text-xs font-semibold text-foreground">{t.title}</p>
                        </div>
                        <Badge variant={isDone ? "success" : isInProgress ? "warning" : "secondary"} className="text-[10px]">
                          {t.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {proj?.name || "Rover Control System"} · Priority: <span className="font-medium text-foreground">{t.priority}</span>
                      </p>
                      {t.tags && t.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap pt-0.5">
                          {t.tags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Today's schedule */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today&#39;s Schedule ({todayDay})</p>
            {todaySlots.length === 0
              ? (
                <div className="p-2.5 rounded-lg bg-muted/60 text-xs text-muted-foreground">
                  {member.schedule.length === 0 ? "No routine uploaded for this semester" : `No classes scheduled on ${todayDay}`}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {todaySlots.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted">
                      <span className="text-[10px] font-mono text-muted-foreground w-24 shrink-0">{s.startTime}–{s.endTime}</span>
                      <span className="text-xs font-medium text-foreground flex-1">{s.course}</span>
                      {s.room && <span className="text-[10px] text-muted-foreground">{s.room}</span>}
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Weekly schedule */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Weekly Schedule ({DAYS.length} Days)</p>
              <span className="text-[10px] font-mono text-muted-foreground">{member.schedule.length} class slots</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5 text-[10px]">
              {DAYS.map(day => {
                const slots = member.schedule.filter(s => s.day === day)
                const isToday = day === todayDay
                return (
                  <div key={day} className={cn("rounded-lg bg-muted p-2 min-h-16 flex flex-col justify-between", isToday && "border border-primary/40 bg-primary/5")}>
                    <div>
                      <p className={cn("font-semibold text-muted-foreground mb-1 flex items-center justify-between", isToday && "text-primary font-bold")}>
                        <span>{day}</span>
                        {isToday && <span className="text-[8px] uppercase tracking-wider bg-primary/20 text-primary px-1 rounded">Today</span>}
                      </p>
                      {slots.length === 0
                        ? <p className="text-muted-foreground/40 italic">Free</p>
                        : slots.map((s, i) => (
                          <div key={i} className="mb-1.5 last:mb-0 border-b border-border/40 pb-1 last:border-0 last:pb-0">
                            <p className="font-medium text-foreground leading-tight">{s.course}</p>
                            <p className="text-muted-foreground font-mono text-[9px] mt-0.5">{s.startTime}–{s.endTime}</p>
                            {s.room && <p className="text-[8px] text-muted-foreground/70">{s.room}</p>}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Approved skills */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approved Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {member.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
            </div>
          </div>

          {/* Manager actions */}
          {canManage && (
            <div className="flex gap-2 pt-1 border-t border-border">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"><Pencil size={12} /> Edit Role</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive">
                <XCircle size={12} /> Remove
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="gap-1.5" asChild>
            <a href={`https://wa.me/${member.whatsapp}`} target="_blank" rel="noreferrer">
              <MessageCircle size={14} /> WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Members Page ─────────────────────────────────────────────────────────────

function MembersPage() {
  const user = useUser()
  const tScope = teamScope(user)
  const stScope = subteamScope(user)
  const canManage = user.role !== "member"

  const [members, setMembers] = useState<Member[]>([])
  const [teamsList, setTeamsList] = useState<string[]>([])
  const [teamFilter, setTeamFilter] = useState(tScope ?? "all")
  const [subteamView, setSubteamView] = useState<"subteam" | "team">(stScope ? "subteam" : "team")
  const [statusFilter, setStatusFilter] = useState<AvailStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selected, setSelected] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      membersApi.getMembers(teamFilter !== "all" ? { team: teamFilter } : {}),
      teamsApi.getTeams(),
    ])
      .then(([m, t]) => {
        setMembers((m || []).map(enrichMemberWithLiveStatus))
        setTeamsList((t || []).map((x: any) => x.name))
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(() => {
      setMembers(prev => prev.map(enrichMemberWithLiveStatus))
    }, 15000)
    return () => clearInterval(timer)
  }, [teamFilter])

  // Filter based on scope, subteam toggle, and search
  const filtered = members.filter(m => {
    if (tScope && m.team !== tScope) return false
    if (subteamView === "subteam" && stScope && !m.subteams.includes(stScope)) return false
    if (statusFilter !== "all" && m.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = m.name.toLowerCase().includes(q)
      const matchSkill = m.skills.some(s => s.toLowerCase().includes(q))
      const matchSub = m.subteams.some(s => s.toLowerCase().includes(q))
      if (!matchName && !matchSkill && !matchSub) return false
    }
    return true
  })

  const freeCount = filtered.filter(m => m.status === "free").length
  const inClassCount = filtered.filter(m => m.status === "in-class").length
  const soonCount = filtered.filter(m => m.status === "soon").length

  const byTeam: Record<string, Member[]> = {}
  filtered.forEach(m => { (byTeam[m.team] = byTeam[m.team] ?? []).push(m) })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {stScope && subteamView === "subteam" ? `${stScope} Subteam Members` : "Team Members Directory"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {loading ? "Loading live member availability..." : `Viewing ${filtered.length} members (${freeCount} free right now)`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Subteam Toggle for Members & Subteam Managers */}
          {stScope && (
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                onClick={() => setSubteamView("subteam")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  subteamView === "subteam" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                My Subteam ({stScope})
              </button>
              <button
                onClick={() => setSubteamView("team")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  subteamView === "team" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All {user.team || "Team"}
              </button>
            </div>
          )}

          {user.role === "org-owner" && teamsList.length > 0 && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Teams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamsList.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {(user.role === "org-owner" || user.role === "team-manager") && (
            <Button size="sm" className="gap-1.5 h-8 text-xs"><Plus size={13} />Add Member</Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={loadData}>
            <RefreshCw size={13} />Refresh
          </Button>
        </div>
      </div>

      {/* Live Availability Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "p-3 rounded-xl border text-left transition-all",
            statusFilter === "all" ? "border-primary bg-primary/10 shadow-sm" : "border-border/60 bg-card hover:bg-muted/30"
          )}
        >
          <p className="text-lg font-bold text-foreground">{filtered.length}</p>
          <p className="text-xs text-muted-foreground font-medium">All Members</p>
        </button>

        <button
          onClick={() => setStatusFilter("free")}
          className={cn(
            "p-3 rounded-xl border text-left transition-all",
            statusFilter === "free" ? "border-success bg-success/15 shadow-sm ring-1 ring-success/30" : "border-success/20 bg-success/5 hover:bg-success/10"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            <p className="text-lg font-bold text-success">{freeCount}</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Free Right Now</p>
        </button>

        <button
          onClick={() => setStatusFilter("in-class")}
          className={cn(
            "p-3 rounded-xl border text-left transition-all",
            statusFilter === "in-class" ? "border-destructive bg-destructive/15 shadow-sm ring-1 ring-destructive/30" : "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            <p className="text-lg font-bold text-destructive">{inClassCount}</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">In Class</p>
        </button>

        <button
          onClick={() => setStatusFilter("soon")}
          className={cn(
            "p-3 rounded-xl border text-left transition-all",
            statusFilter === "soon" ? "border-warning bg-warning/15 shadow-sm ring-1 ring-warning/30" : "border-warning/20 bg-warning/5 hover:bg-warning/10"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <p className="text-lg font-bold text-warning">{soonCount}</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Class Soon (&lt;30m)</p>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search teammates by name, skill (e.g. ROS2, Python, CAD), or subteam..."
          className="pl-9 text-xs h-9"
        />
      </div>

      {/* Main Members Content */}
      {loading ? (
        <Card><CardContent className="py-16 text-center">
          <RefreshCw size={24} className="mx-auto mb-3 text-muted-foreground/30 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading members live availability...</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Users size={32} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">No teammates match this filter</p>
          <p className="text-xs text-muted-foreground mt-1">Try switching to All Members or resetting the search filter</p>
        </CardContent></Card>
      ) : (
        Object.entries(byTeam).map(([team, teamMembers]) => (
          <div key={team} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{team}</h2>
              <Badge variant="secondary" className="font-mono text-xs">{teamMembers.length}</Badge>
              <Separator className="flex-1" />
              <span className="text-xs text-success font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {teamMembers.filter(m => m.status === "free").length} free now
              </span>
            </div>

            <Card className="overflow-hidden border-border/80">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-4">Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Subteam(s)</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Availability Status</TableHead>
                    <TableHead>Skills</TableHead>
                    <TableHead className="w-12 text-right pr-4">Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map(m => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelected(m)}
                    >
                      <TableCell className="pl-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <MemberAvatar member={m} />
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-none">{m.name}</p>
                            {m.currentClass ? (
                              <p className="text-[11px] text-muted-foreground mt-1 font-mono">{m.currentClass}</p>
                            ) : m.status === "free" ? (
                              <p className="text-[11px] text-success mt-1 font-medium">Free for meeting / work</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{roleLabel(m.role as UserRole)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {m.subteams.map(s => (
                            <Badge
                              key={s}
                              variant={s === stScope ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{m.batch}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <StatusBadge status={m.status} />
                          {m.remainingMin !== undefined && m.status === "in-class" && (
                            <p className="text-[10px] text-muted-foreground font-mono">Free in ~{m.remainingMin}m</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {m.skills.slice(0, 2).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                          {m.skills.length > 2 && <Badge variant="outline" className="text-[10px]">+{m.skills.length - 2}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-success hover:text-success hover:bg-success/10" asChild>
                          <a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noreferrer" title="Chat on WhatsApp">
                            <MessageCircle size={14} />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        ))
      )}

      <MemberDialog member={selected} open={!!selected} onOpenChange={o => !o && setSelected(null)} canManage={canManage} />
    </div>
  )
}

// ─── Search Page ──────────────────────────────────────────────────────────────

function SearchPage() {
  const user = useUser()
  const tScope = teamScope(user)
  const stScope = subteamScope(user)

  const [query, setQuery] = useState("")
  const [team, setTeam] = useState(tScope ?? "all")
  const [sub, setSub] = useState(stScope ?? "all")
  const [status, setStatus] = useState("all")
  const [skill, setSkill] = useState("all")
  const [day, setDay] = useState("all")
  const [time, setTime] = useState("all")
  const [batch, setBatch] = useState("all")
  const [selected, setSelected] = useState<Member | null>(null)
  const [results, setResults] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [teamsList, setTeamsList] = useState<string[]>([])
  const [subsList, setSubsList] = useState<string[]>([])
  const [batchList, setBatchList] = useState<string[]>([])
  const [skillList, setSkillList] = useState<string[]>([])

  // Load filter options on mount
  useEffect(() => {
    Promise.all([teamsApi.getTeams(), teamsApi.getOrgMeta()])
      .then(([teams, meta]) => {
        const allTeams = (teams || []).map((t: any) => t.name)
        const allSubs = [...new Set((teams || []).flatMap((t: any) => (t.subteams || []).map((s: any) => s.name)))]
        setTeamsList(allTeams)
        setSubsList(allSubs)
        setBatchList(meta?.batches || [])
        setSkillList((meta?.skills || []).map((s: any) => s.name))
      })
      .catch(() => { })
  }, [])

  // Load members from API whenever filters change
  useEffect(() => {
    setLoading(true)
    const filters: Record<string, string> = {}
    if (query.trim()) filters.search = query.trim()
    if (team !== "all") filters.team = team
    if (sub !== "all") filters.subteam = sub
    if (status !== "all") filters.status = status
    if (skill !== "all") filters.skill = skill
    if (batch !== "all") filters.batch = batch
    if (day !== "all") filters.day = day
    const enrichMemberStatus = (m: Member): Member => {
      const d = day !== "all" ? (day as DayOfWeek) : undefined
      const t = time !== "all" ? time : undefined
      const live = computeLiveAvailability(m.schedule, d, t)
      return {
        ...m,
        status: live.status,
        nextChange: live.nextChange,
        currentClass: live.currentClass,
        remainingMin: live.remainingMin,
      }
    }

    membersApi.getMembers(filters)
      .then(res => setResults((res || []).map(enrichMemberStatus)))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [query, team, sub, status, skill, batch, day, time])

  // Live timer to continuously recompute status every 15s
  useEffect(() => {
    const enrichMemberStatus = (m: Member): Member => {
      const d = day !== "all" ? (day as DayOfWeek) : undefined
      const t = time !== "all" ? time : undefined
      const live = computeLiveAvailability(m.schedule, d, t)
      return {
        ...m,
        status: live.status,
        nextChange: live.nextChange,
        currentClass: live.currentClass,
        remainingMin: live.remainingMin,
      }
    }
    const timer = setInterval(() => {
      setResults(prev => prev.map(enrichMemberStatus))
    }, 15000)
    return () => clearInterval(timer)
  }, [day, time])

  // Client-side day/time & instantaneous text filter for smooth UX
  const filteredResults = results.filter(m => {
    if (day !== "all" && time !== "all" && !isFreeAt(m, day as DayOfWeek, time)) {
      return false
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim()
      const matchName = (m.name || "").toLowerCase().includes(q)
      const matchInitials = (m.initials || "").toLowerCase().includes(q)
      const matchTeam = (m.team || "").toLowerCase().includes(q)
      const matchSub = (m.subteams || []).some(s => s.toLowerCase().includes(q))
      const matchSkill = (m.skills || []).some(s => s.toLowerCase().includes(q))
      const matchBatch = (m.batch || "").includes(q)
      if (!matchName && !matchInitials && !matchTeam && !matchSub && !matchSkill && !matchBatch) {
        return false
      }
    }
    return true
  })

  const dayTimeActive = day !== "all" && time !== "all"
  const dirty = Boolean(
    query.trim() ||
    team !== "all" ||
    sub !== "all" ||
    status !== "all" ||
    skill !== "all" ||
    batch !== "all" ||
    day !== "all" ||
    time !== "all"
  )

  const reset = () => {
    setQuery("")
    setTeam("all")
    setSub("all")
    setStatus("all")
    setSkill("all")
    setBatch("all")
    setDay("all")
    setTime("all")
  }

  const [dhakaNow, setDhakaNow] = useState<Date>(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setDhakaNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Find Members</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {stScope ? `Search within ${stScope} subteam`
              : tScope ? `Search within ${tScope} team`
                : "Search by name, team, subteam, day/time, skill, or availability"
            }
          </p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}{loading ? " · loading…" : ""}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-muted/60 border border-border font-mono shadow-xs">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Clock size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-foreground tracking-tight">
                  {formatDhakaTime(dhakaNow)}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary font-semibold">
                  BST
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans">
                {formatDhakaDate(dhakaNow)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Row 1 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-44">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)} className="pl-8" />
            </div>
            {!tScope && teamsList.length > 0 && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teamsList.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!stScope && subsList.length > 0 && (
              <Select value={sub} onValueChange={setSub}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Subteam" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subteams</SelectItem>
                  {subsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Availability" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="free">Free Now</SelectItem>
                <SelectItem value="in-class">In Class</SelectItem>
                <SelectItem value="soon">Class Soon</SelectItem>
                <SelectItem value="missing">No Routine</SelectItem>
              </SelectContent>
            </Select>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Skill" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Skill</SelectItem>
                {skillList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {batchList.length > 0 && (
              <Select value={batch} onValueChange={setBatch}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Batch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Batch</SelectItem>
                  {batchList.map(b => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Row 2 — Day + Time (key feature from spec) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Availability at:</span>
            </div>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Day" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Day</SelectItem>
                {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Time" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Time</SelectItem>
                {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
            {dayTimeActive && (
              <Badge variant="success" className="text-[11px] gap-1">
                <CheckCircle2 size={10} />
                Free on {day} at {time}
              </Badge>
            )}
            {(tScope || stScope) && (
              <div className="ml-auto flex items-center gap-1.5">
                <Lock size={10} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Scoped to {stScope ?? tScope}</span>
              </div>
            )}
            {dirty && (
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground ml-auto">
                <Filter size={13} /> Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {filteredResults.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search size={32} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">
              {dirty ? "No members match your filters" : "No members yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {dirty ? "Try broadening the search criteria" : "Register team members to see them here"}
            </p>
            {dirty && <Button variant="outline" size="sm" className="mt-4" onClick={reset}>Reset filters</Button>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Member</TableHead>
                <TableHead>Team / Subteam(s)</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="font-mono text-[11px]">Next Change</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map(m => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar member={m} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        {dayTimeActive && (
                          <p className="text-[10px] text-success flex items-center gap-1">
                            <CheckCircle2 size={9} /> Free {day} {time}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.team} / {(m.subteams || []).join(", ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.batch}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(m.skills || []).map(s => (
                        <Badge key={s} variant={skill === s ? "default" : "secondary"} className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.nextChange}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" asChild>
                      <a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noreferrer">
                        <MessageCircle size={12} /> Chat
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <MemberDialog member={selected} open={!!selected} onOpenChange={o => !o && setSelected(null)} canManage={false} />
    </div>
  )
}

// ─── Heatmap Page ─────────────────────────────────────────────────────────────

function HeatmapPage() {
  const user = useUser()
  const tScope = teamScope(user)

  const [fromHour, setFromHour] = useState("08:00")
  const [toHour, setToHour] = useState("17:00")
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => getTodayDayOfWeek())
  const [heatData, setHeatData] = useState<any>(null)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("live")
  const [selectedSnap, setSelectedSnap] = useState<any>(null)
  const [subteamTeam, setSubteamTeam] = useState("")

  const loadHeatmap = () => {
    setLoading(true)
    Promise.all([
      heatmapApi.getHeatmap(),
      heatmapApi.getSnapshots(),
    ])
      .then(([live, snaps]) => {
        setHeatData(live)
        setSnapshots(snaps || [])
        // Default subteamTeam to first available team
        const firstTeam = Object.keys(live?.teamMatrix || {})[0] || ""
        setSubteamTeam(st => st || firstTeam)
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadHeatmap() }, [])

  const displayData = activeTab === "snapshot" && selectedSnap ? selectedSnap.matrix : heatData

  const teams = displayData ? Object.keys(displayData.teamMatrix || {}) : []
  const hours = (displayData?.hours || HOURS).filter((h: string) => h >= fromHour && h <= toHour)

  const defaultTab = tScope ? "team" : "org"

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Availability Heatmap</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Identify peak collaboration windows across all 7 days. Updated every 12 hours.</p>
          {heatData?.computedAt && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Last computed: {formatDhakaDateTime(heatData.computedAt)} (BST)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={loadHeatmap}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
          {/* Time range */}
          <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border">
            <Select value={fromHour} onValueChange={setFromHour}>
              <SelectTrigger className="w-20 h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-muted-foreground text-xs">to</span>
            <Select value={toHour} onValueChange={setToHour}>
              <SelectTrigger className="w-20 h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-20 text-center">
          <RefreshCw size={28} className="mx-auto mb-3 text-muted-foreground/30 animate-spin" />
          <p className="text-sm text-muted-foreground">Computing heatmap...</p>
        </CardContent></Card>
      ) : teams.length === 0 ? (
        <Card><CardContent className="py-20 text-center">
          <BarChart3 size={32} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">No availability data yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Heatmap appears after members register and upload their class routines.
          </p>
        </CardContent></Card>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <TabsList>
                {!tScope && <TabsTrigger value="org">Organization</TabsTrigger>}
                <TabsTrigger value="team">By Team</TabsTrigger>
                <TabsTrigger value="subteam">By Subteam</TabsTrigger>
              </TabsList>

              {/* Interactive Day Selection */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
                <span className="text-[11px] font-medium text-muted-foreground px-1.5">Day:</span>
                {DAYS.map(d => (
                  <Button
                    key={d}
                    size="sm"
                    variant={selectedDay === d ? "default" : "ghost"}
                    className={cn("h-6 text-xs px-2 rounded-md font-medium", selectedDay === d && "shadow-xs")}
                    onClick={() => setSelectedDay(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>

            {/* Snapshot history toggle */}
            {snapshots.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Source:</span>
                <Select value={activeTab} onValueChange={v => {
                  setActiveTab(v)
                  if (v === "live") {
                    setSelectedSnap(null)
                  } else {
                    const found = snapshots.find(s => s.id === v)
                    if (found) setSelectedSnap(found)
                  }
                }}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Live Now" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live Now (Real-time)</SelectItem>
                    {snapshots.map((s, i) => (
                      <SelectItem key={s.id} value={s.id}>
                        Snap {i + 1} · {formatDhakaDate(new Date(s.computedAt))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── Organization view ── */}
          {!tScope && (
            <TabsContent value="org" className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-5 w-28">Time ({selectedDay})</TableHead>
                        {teams.map((t: string) => (
                          <TableHead key={t} className="text-center">
                            <div className="text-foreground">{t}</div>
                            <div className="text-[10px] font-normal text-muted-foreground">{displayData?.teamTotals?.[t] ?? 0} members</div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Window</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hours.map((h: string) => {
                        const ratios = teams.map((t: string) => {
                          const cell = displayData?.teamMatrix?.[t]?.[selectedDay]?.[h]
                          return cell ? cell.free / Math.max(cell.total, 1) : 0
                        })
                        const best = Math.max(...ratios)
                        return (
                          <TableRow key={h}>
                            <TableCell className="pl-5 font-mono text-xs text-muted-foreground">{h}</TableCell>
                            {teams.map((t: string, i: number) => {
                              const cell = displayData?.teamMatrix?.[t]?.[selectedDay]?.[h]
                              const free = cell?.free ?? 0
                              const total = cell?.total ?? 0
                              const ratio = ratios[i]
                              return (
                                <Tooltip key={t}>
                                  <TooltipTrigger asChild>
                                    <TableCell className="text-center">
                                      <Badge variant={heatBadgeVariant(ratio)} className="font-mono cursor-default">
                                        {free}/{total}
                                      </Badge>
                                    </TableCell>
                                  </TooltipTrigger>
                                  <TooltipContent>{Math.round(ratio * 100)}% of {t} free on {selectedDay} at {h}</TooltipContent>
                                </Tooltip>
                              )
                            })}
                            <TableCell className="text-center">
                              {best >= 0.75
                                ? <Badge variant="success"><TrendingUp size={10} /> Good slot</Badge>
                                : <span className="text-xs text-muted-foreground">—</span>
                              }
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Legend ({selectedDay})</span>
                <Badge variant="success">≥ 75% free</Badge>
                <Badge variant="warning">50–75% free</Badge>
                <Badge variant="destructive">{"< 50% free"}</Badge>
              </div>
            </TabsContent>
          )}

          {/* ── By Team view ── */}
          <TabsContent value="team" className="mt-4">
            <div className={`grid gap-4 ${teams.length === 1 ? "grid-cols-1 max-w-lg" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
              {teams.map((team: string) => (
                <Card key={team}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{team}</CardTitle>
                    <CardDescription className="text-xs">{displayData?.teamTotals?.[team] ?? 0} members total</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2.5">
                    {DAYS.map(day => {
                      // Show all days summary — pick best hour per day
                      const dayData = displayData?.teamMatrix?.[team]?.[day]
                      if (!dayData) return null
                      const total = displayData?.teamTotals?.[team] ?? 0
                      const bestH = hours.reduce((best: string, h: string) => {
                        const f = dayData[h]?.free ?? 0
                        const bf = dayData[best]?.free ?? 0
                        return f > bf ? h : best
                      }, hours[0] ?? "09:00")
                      const bestFree = dayData[bestH]?.free ?? 0
                      const ratio = total > 0 ? bestFree / total : 0
                      const ind = ratio >= 0.7 ? "bg-success" : ratio >= 0.5 ? "bg-warning" : "bg-destructive"
                      return (
                        <div key={day} className={cn("flex items-center gap-2 p-1 rounded-md", day === selectedDay && "bg-muted")}>
                          <span className={cn("text-[10px] font-mono w-7 shrink-0", day === selectedDay ? "text-primary font-bold" : "text-muted-foreground")}>{day}</span>
                          <Progress value={ratio * 100} className="flex-1 h-1.5 bg-secondary" indicatorClassName={ind} />
                          <span className="text-[10px] font-mono text-muted-foreground w-14 text-right">Best {bestH}</span>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── By Subteam view ── */}
          <TabsContent value="subteam" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Team:</span>
              <div className="flex gap-1.5">
                {teams.map((t: string) => (
                  <Button key={t} size="sm"
                    variant={subteamTeam === t ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setSubteamTeam(t)}>
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {displayData?.subteamMatrix?.[subteamTeam] ? (() => {
              const subNames = Object.keys(displayData.subteamMatrix[subteamTeam])
              return (
                <>
                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-5 w-28">Time ({selectedDay})</TableHead>
                            {subNames.map((sub: string) => (
                              <TableHead key={sub} className="text-center">
                                <div className="text-foreground">{sub}</div>
                                <div className="text-[10px] font-normal text-muted-foreground">
                                  {displayData?.subteamTotals?.[subteamTeam]?.[sub] ?? 0} members
                                </div>
                              </TableHead>
                            ))}
                            <TableHead className="text-center">Window</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hours.map((h: string) => {
                            const ratios = subNames.map((sub: string) => {
                              const cell = displayData.subteamMatrix[subteamTeam]?.[sub]?.[selectedDay]?.[h]
                              return cell ? cell.free / Math.max(cell.total, 1) : 0
                            })
                            const best = Math.max(...ratios)
                            return (
                              <TableRow key={h}>
                                <TableCell className="pl-5 font-mono text-xs text-muted-foreground">{h}</TableCell>
                                {subNames.map((sub: string, i: number) => {
                                  const cell = displayData.subteamMatrix[subteamTeam]?.[sub]?.[selectedDay]?.[h]
                                  const free = cell?.free ?? 0
                                  const total = cell?.total ?? 0
                                  return (
                                    <Tooltip key={sub}>
                                      <TooltipTrigger asChild>
                                        <TableCell className="text-center">
                                          <Badge variant={heatBadgeVariant(ratios[i])} className="font-mono cursor-default">
                                            {free}/{total}
                                          </Badge>
                                        </TableCell>
                                      </TooltipTrigger>
                                      <TooltipContent>{Math.round(ratios[i] * 100)}% of {sub} free at {h}</TooltipContent>
                                    </Tooltip>
                                  )
                                })}
                                <TableCell className="text-center">
                                  {best >= 0.75
                                    ? <Badge variant="success"><TrendingUp size={10} /> Good slot</Badge>
                                    : <span className="text-xs text-muted-foreground">—</span>
                                  }
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Legend</span>
                    <Badge variant="success">≥ 75% free</Badge>
                    <Badge variant="warning">50–75% free</Badge>
                    <Badge variant="destructive">{"< 50% free"}</Badge>
                  </div>
                </>
              )
            })() : (
              <Card><CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No subteam data for this team</p>
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// ─── Skills Page ──────────────────────────────────────────────────────────────


function SkillsPage() {
  const user = useUser()
  const tScope = teamScope(user)
  const stScope = subteamScope(user)
  const isMember = user.role === "member"

  const [pending, setPending] = useState<any[]>([])
  const [catalog, setCatalog] = useState<any[]>([])
  const [mySkills, setMySkills] = useState<string[]>([])
  const [myPending, setMyPending] = useState<string[]>([])
  const [requesting, setRequesting] = useState(false)
  const [requestMode, setRequestMode] = useState<"catalog" | "custom">("catalog")
  const [requested, setRequested] = useState("")
  const [customSkillName, setCustomSkillName] = useState("")
  const [customCategory, setCustomCategory] = useState("General")
  const [addCatalogOpen, setAddCatalogOpen] = useState(false)
  const [newCatSkill, setNewCatSkill] = useState("")
  const [newCatCategory, setNewCatCategory] = useState("Software")
  const [catError, setCatError] = useState<string | null>(null)
  const [reqError, setReqError] = useState<string | null>(null)

  const reloadSkills = () => {
    skillsApi.getPendingSkills()
      .then(res => {
        const filtered = (res || []).filter((r: any) => {
          if (tScope && r.team !== tScope) return false
          if (stScope && r.subteam !== stScope) return false
          return true
        })
        setPending(filtered)
      })
      .catch(() => setPending([]))

    skillsApi.getSkillsCatalog()
      .then(res => {
        setCatalog(res.catalog || [])
        setMySkills(res.mySkills?.filter((s: any) => s.status === "APPROVED").map((s: any) => s.name) || [])
        setMyPending(res.mySkills?.filter((s: any) => s.status === "PENDING").map((s: any) => s.name) || [])
      })
      .catch(() => { })
  }

  useEffect(() => {
    reloadSkills()
  }, [tScope, stScope])

  function approve(id: string) {
    skillsApi.approveSkill(id).then(() => {
      setPending(p => p.filter(x => x.id !== id))
      reloadSkills()
    })
  }
  function reject(id: string) {
    skillsApi.rejectSkill(id).then(() => {
      setPending(p => p.filter(x => x.id !== id))
      reloadSkills()
    })
  }

  function handleRequestSkill() {
    setReqError(null)
    const targetName = (requestMode === "catalog" ? requested : customSkillName).trim()
    if (!targetName) {
      setReqError("Please enter or select a skill name.")
      return
    }
    if (mySkills.some(s => s.toLowerCase() === targetName.toLowerCase())) {
      setReqError("This skill is already approved on your profile.")
      return
    }
    if (myPending.some(s => s.toLowerCase() === targetName.toLowerCase())) {
      setReqError("A request for this skill is already pending manager approval.")
      return
    }

    skillsApi.requestSkill(targetName, customCategory)
      .then(() => {
        setMyPending(p => [...p, targetName])
        setRequested("")
        setCustomSkillName("")
        setRequesting(false)
        reloadSkills()
      })
      .catch((err: any) => {
        setReqError(err.message || "Failed to submit skill request.")
      })
  }

  function handleAddCatalogSkill() {
    setCatError(null)
    const name = newCatSkill.trim()
    if (!name) {
      setCatError("Please enter a skill name.")
      return
    }

    skillsApi.createSkill(name, newCatCategory)
      .then(() => {
        setNewCatSkill("")
        setAddCatalogOpen(false)
        reloadSkills()
      })
      .catch((err: any) => {
        setCatError(err.message || "Failed to create skill.")
      })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Skills</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isMember ? "Your skill profile and pending requests" : "Review and approve member skill requests"}
          </p>
        </div>
        {isMember && (
          <Button size="sm" className="gap-1.5" onClick={() => { setReqError(null); setRequesting(true) }}>
            <Plus size={13} /> Request Skill
          </Button>
        )}
      </div>

      {/* Member view */}
      {isMember && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My Approved Skills</CardTitle>
              <CardDescription className="text-xs">Skills verified by your manager — appear in search results</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {mySkills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved skills yet. Click &quot;Request Skill&quot; to add.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {mySkills.map(s => (
                    <Badge key={s} variant="success" className="gap-1.5 text-xs py-1 px-2.5">
                      <CheckCircle2 size={11} /> {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pending Requests</CardTitle>
              <CardDescription className="text-xs">Awaiting manager approval · not yet searchable</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {myPending.length === 0
                ? <p className="text-sm text-muted-foreground">No pending requests</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {myPending.map(s => (
                      <Badge key={s} variant="warning" className="gap-1.5 text-xs py-1 px-2.5">
                        <AlertCircle size={11} /> {s}
                      </Badge>
                    ))}
                  </div>
                )
              }
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manager / Owner view */}
      {!isMember && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Pending Approvals</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {stScope ? `${stScope} subteam` : tScope ? `${tScope} team` : "Organization-wide"} · awaiting your review
                    </CardDescription>
                  </div>
                  {pending.length > 0 && <Badge variant="warning" className="font-mono">{pending.length} pending</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {pending.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 size={32} className="mx-auto mb-3 text-success opacity-60" />
                    <p className="text-sm font-medium text-foreground">All caught up</p>
                    <p className="text-xs text-muted-foreground mt-1">No pending skill approvals in your scope</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-3">Member</TableHead>
                        <TableHead>Team / Subteam</TableHead>
                        <TableHead>Skill</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right pr-3">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="pl-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-7 h-7">
                                <AvatarFallback className="text-xs bg-accent text-accent-foreground">{r.initials}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-foreground">{r.member}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.team} / {r.subteam}</TableCell>
                          <TableCell><Badge variant="secondary" className="font-mono">{r.skill}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{r.requested}</TableCell>
                          <TableCell className="text-right pr-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => approve(r.id)}>
                                <CheckCircle2 size={12} /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => reject(r.id)}>
                                <XCircle size={12} /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Skill Catalog</CardTitle>
                  <CardDescription className="text-xs">Approved members per skill</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setCatError(null); setAddCatalogOpen(true) }}>
                  <Plus size={11} /> Add Skill
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              {catalog.map(s => {
                const count = s.count || 0
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-sm text-foreground flex-1">{s.name}</span>
                    <Progress value={Math.min(count * 10, 100)} className="w-16 h-1.5 bg-secondary" />
                    <span className="text-xs font-mono text-muted-foreground w-4 text-right">{count}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skill request dialog */}
      <Dialog open={requesting} onOpenChange={setRequesting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request a New Skill</DialogTitle>
            <DialogDescription>Select an existing skill or add an open/custom skill not in the catalog.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                size="sm"
                variant={requestMode === "catalog" ? "default" : "ghost"}
                className="flex-1 h-7 text-xs"
                onClick={() => setRequestMode("catalog")}
              >
                From Catalog
              </Button>
              <Button
                type="button"
                size="sm"
                variant={requestMode === "custom" ? "default" : "ghost"}
                className="flex-1 h-7 text-xs"
                onClick={() => setRequestMode("custom")}
              >
                + Add / Open Skill
              </Button>
            </div>

            {requestMode === "catalog" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Select Predefined Skill</label>
                <Select value={requested} onValueChange={setRequested}>
                  <SelectTrigger><SelectValue placeholder="Choose a skill" /></SelectTrigger>
                  <SelectContent>
                    {catalog.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name} ({s.category || "General"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Open / Custom Skill Name</label>
                  <Input
                    placeholder="e.g. ROS2 Humble, SolidWorks, PyTorch"
                    value={customSkillName}
                    onChange={e => setCustomSkillName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <Select value={customCategory} onValueChange={setCustomCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Software">Software</SelectItem>
                      <SelectItem value="Hardware">Hardware / Embedded</SelectItem>
                      <SelectItem value="Robotics">Robotics / Autonomous</SelectItem>
                      <SelectItem value="Design">Mechanical / Design</SelectItem>
                      <SelectItem value="Media">Media & PR</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {reqError && (
              <p className="text-xs font-medium text-destructive bg-destructive/10 p-2.5 rounded-lg">
                {reqError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequesting(false)}>Cancel</Button>
            <Button onClick={handleRequestSkill}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Catalog Dialog (Manager/Owner) */}
      <Dialog open={addCatalogOpen} onOpenChange={setAddCatalogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Skill to Catalog</DialogTitle>
            <DialogDescription>Register a new skill in the organization catalog so members can select and verify it.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Skill Name</label>
              <Input
                placeholder="e.g. Next.js, Altium Designer, OpenCV"
                value={newCatSkill}
                onChange={e => setNewCatSkill(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={newCatCategory} onValueChange={setNewCatCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Hardware">Hardware / Embedded</SelectItem>
                  <SelectItem value="Robotics">Robotics / Autonomous</SelectItem>
                  <SelectItem value="Design">Mechanical / Design</SelectItem>
                  <SelectItem value="Media">Media & PR</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {catError && (
              <p className="text-xs font-medium text-destructive bg-destructive/10 p-2.5 rounded-lg">
                {catError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCatalogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCatalogSkill}>Add to Catalog</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Teams Tab ────────────────────────────────────────────────────────────────

function TeamsTab({ user }: { user: AppUser }) {
  const [managingTeam, setManagingTeam] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [addSubteam, setAddSubteam] = useState("")
  const [saved, setSaved] = useState(false)

  const isOwner = user.role === "org-owner"
  const [teamsData, setTeamsData] = useState<any[]>([])
  const items = isOwner
    ? teamsData.map(t => t.name)
    : teamsData.flatMap(t => (t.subteams || []).map((s: any) => s.name))

  useEffect(() => {
    teamsApi.getTeams().then(setTeamsData).catch(() => { })
  }, [])

  const managedPool: any[] = []
  const subteamsOfTeam = managingTeam && isOwner
    ? (teamsData.find(t => t.name === managingTeam)?.subteams || []).map((s: any) => s.name)
    : []

  function openManage(name: string) {
    setManagingTeam(name)
    setNewName(name)
    setSaved(false)
    setAddSubteam("")
  }

  return (
    <>
      <TabsContent value="teams" className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {user.role === "team-manager" ? `${user.team} — Subteams` : "Teams & Subteams"}
                </CardTitle>
                <CardDescription>
                  {user.role === "team-manager" ? "Manage your team's subteams" : "Manage all organization teams"}
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5">
                <Plus size={13} />{user.role === "team-manager" ? "Add Subteam" : "Add Team"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isOwner ? "Team" : "Subteam"}</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Free Now</TableHead>
                  <TableHead>Missing Routine</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    No {isOwner ? "teams" : "subteams"} yet. Create them to manage members.
                  </TableCell></TableRow>
                ) : items.map(name => (
                  <TableRow key={name}>
                    <TableCell className="font-medium text-sm text-foreground">{name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                    <TableCell><Badge variant="muted" className="font-mono">—</Badge></TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(name)}>
                        <Pencil size={11} />Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Team / Subteam Manage Dialog */}
      <Dialog open={!!managingTeam} onOpenChange={o => !o && setManagingTeam(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 size={15} className="text-primary" />
              </div>
              Manage {isOwner ? "Team" : "Subteam"}: {managingTeam}
            </DialogTitle>
            <DialogDescription>
              {isOwner ? "Rename team, review subteams, and manage members." : "Manage subteam members and settings."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Rename */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isOwner ? "Team" : "Subteam"} Name</label>
              <div className="flex gap-2">
                <Input value={newName} onChange={e => { setNewName(e.target.value); setSaved(false) }} className="flex-1" />
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setSaved(true)} disabled={newName === managingTeam || !newName}>
                  {saved ? <><CheckCircle2 size={13} /> Saved</> : <><Save size={13} /> Rename</>}
                </Button>
              </div>
            </div>

            {/* Subteams list (org-owner only) */}
            {isOwner && subteamsOfTeam.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Subteams</p>
                <div className="flex flex-wrap gap-1.5">
                  {subteamsOfTeam.map((s: string) => (
                    <div key={s} className="flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5">
                      <span className="text-xs text-foreground">{s}</span>
                      <button className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
                        <XCircle size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="New subteam…"
                      value={addSubteam}
                      onChange={e => setAddSubteam(e.target.value)}
                      className="h-7 text-xs w-28"
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!addSubteam}>
                      <Plus size={11} />Add
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Members list */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Members ({managedPool.length})</p>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {managedPool.filter(m => m.status === "free").length} free now
                </Badge>
              </div>
              <ScrollArea className="h-52 rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {managedPool.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-8">No members in this {isOwner ? "team" : "subteam"}</p>
                    : managedPool.map(m => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                        <MemberAvatar member={m} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.batch} · {m.subteams.join(", ")}</p>
                        </div>
                        <StatusBadge status={m.status} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0">
                              <ChevronDown size={12} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-[11px]">Member Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-xs gap-2"><Pencil size={12} />Change Role</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs gap-2"><ArrowUpRight size={12} />Move to Team</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive">
                              <XCircle size={12} />Remove from {isOwner ? "team" : "subteam"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))
                  }
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManagingTeam(null)}>Close</Button>
            <Button className="gap-1.5 text-destructive hover:text-destructive" variant="outline">
              <XCircle size={13} /> Delete {isOwner ? "Team" : "Subteam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Settings Page ─────────────────────────────────────────────────────────────

function SettingsPage({ onUploadRoutine }: { onUploadRoutine: () => void }) {
  const { user, pagePerms, setPagePerms, featurePerms, setFeaturePerms } = useUserCtx()
  const defaultTab = "profile"

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your personal profile, class routine, and team settings
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {user.role === "org-owner" && <TabsTrigger value="semester">Semester</TabsTrigger>}
          {user.role === "org-owner" && <TabsTrigger value="access">Access Control</TabsTrigger>}
          {(user.role === "org-owner" || user.role === "team-manager") && <TabsTrigger value="teams">Teams</TabsTrigger>}
          <TabsTrigger value="routine">{user.role === "member" ? "My Schedule" : "Routine Upload"}</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* Profile Tab — Available to all users */}
        <ProfileTab />

        {/* Semester — Org Owner only */}
        {user.role === "org-owner" && (
          <TabsContent value="semester" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Semester Configuration</CardTitle>
                <CardDescription>Fall 2026 — Sep 1 to Dec 31</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Semester Name", value: "Fall 2026" },
                    { label: "Start Date", value: "September 1, 2026" },
                    { label: "End Date", value: "December 31, 2026" },
                    { label: "Upload Deadline", value: "September 10, 2026" },
                  ].map(f => (
                    <div key={f.label} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                      <Input defaultValue={f.value} />
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-warning" />
                    Post-deadline enforcement
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Members who have not uploaded a valid routine after the deadline will be restricted from the platform until they upload their current semester schedule.
                  </p>
                </div>
                <Separator />
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Cancel</Button>
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Access Control — Org Owner only */}
        {user.role === "org-owner" && (
          <TabsContent value="access" className="mt-4 space-y-4">
            {/* Page Access Control */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Page Access</CardTitle>
                    <CardDescription>Toggle which pages each role can navigate to. Changes take effect immediately.</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-[10px] gap-1"><Shield size={10} />Live</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Role</TableHead>
                      <TableHead>Allowed Pages</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["team-manager", "subteam-manager", "member"] as UserRole[]).map(role => {
                      const allowed = pagePerms[role] ?? []
                      return (
                        <TableRow key={role}>
                          <TableCell className="font-medium text-sm text-foreground align-top pt-3">{roleLabel(role)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {ALL_PAGE_OPTIONS.map(pg => {
                                const on = allowed.includes(pg.id)
                                return (
                                  <button
                                    key={pg.id}
                                    onClick={() => {
                                      const next = on
                                        ? allowed.filter(x => x !== pg.id)
                                        : [...allowed, pg.id]
                                      setPagePerms({ ...pagePerms, [role]: next })
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-all",
                                      on
                                        ? "bg-success/15 border-success/40 text-success hover:bg-success/25"
                                        : "bg-muted border-border text-muted-foreground/50 line-through hover:bg-accent"
                                    )}
                                  >
                                    {on ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                                    {pg.label}
                                  </button>
                                )
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                  <Lock size={9} /> Organization Owner always has full access and cannot be restricted.
                </p>
              </CardContent>
            </Card>

            {/* Feature Permissions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Feature Permissions</CardTitle>
                <CardDescription>Grant or revoke specific capabilities per role. Click a badge to toggle.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Role</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Capabilities</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {([
                      { roleKey: "org-owner" as UserRole, scope: "Entire org", locked: true },
                      { roleKey: "team-manager" as UserRole, scope: "Assigned team", locked: false },
                      { roleKey: "subteam-manager" as UserRole, scope: "Assigned subteam", locked: false },
                      { roleKey: "member" as UserRole, scope: "Own subteam(s)", locked: false },
                    ]).map(({ roleKey, scope, locked }) => {
                      const enabled = featurePerms[roleKey] ?? []
                      const allOpts = ALL_FEATURE_OPTIONS[roleKey] ?? enabled
                      return (
                        <TableRow key={roleKey}>
                          <TableCell className="font-medium text-sm text-foreground align-top pt-3">{roleLabel(roleKey)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono align-top pt-3 whitespace-nowrap">{scope}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {allOpts.map(p => {
                                const on = enabled.includes(p)
                                if (locked) return (
                                  <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium bg-secondary text-secondary-foreground">
                                    <CheckCircle2 size={9} className="text-success" />{p}
                                  </span>
                                )
                                return (
                                  <button
                                    key={p}
                                    onClick={() => {
                                      const next = on
                                        ? enabled.filter(x => x !== p)
                                        : [...enabled, p]
                                      setFeaturePerms({ ...featurePerms, [roleKey]: next })
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-all",
                                      on
                                        ? "bg-secondary border-border text-secondary-foreground hover:bg-accent"
                                        : "bg-muted border-border text-muted-foreground/40 line-through hover:bg-accent"
                                    )}
                                  >
                                    {on ? <CheckCircle2 size={9} className="text-success" /> : <XCircle size={9} className="text-destructive/50" />}
                                    {p}
                                  </button>
                                )
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Teams — Org Owner and Team Manager */}
        {(user.role === "org-owner" || user.role === "team-manager") && (
          <TeamsTab user={user} />
        )}

        {/* Routine Upload — all roles */}
        <TabsContent value="routine" className="mt-4">
          <RoutineTab onUploadRoutine={onUploadRoutine} />
        </TabsContent>

        {/* Account Tab */}
        <AccountTab />
      </Tabs>
    </div>
  )
}

function RoutineTab({ onUploadRoutine }: { onUploadRoutine: () => void }) {
  const { user } = useUserCtx()
  const [schedule, setSchedule] = useState<ClassSlot[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSchedule = () => {
    setLoading(true)
    routinesApi.getMyRoutine()
      .then(res => {
        if (Array.isArray(res)) setSchedule(res)
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSchedule()
  }, [])

  const labCount = schedule.filter(s => s.course.toLowerCase().includes("lab") || s.course.toLowerCase().includes("laboratory")).length
  const theoryCount = schedule.length - labCount

  // Group by day according to DAYS order
  const groupedByDay = DAYS.map(day => ({
    day,
    slots: schedule.filter(s => s.day === day),
  })).filter(g => g.slots.length > 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">
            {user.role === "member" ? "My Class Schedule" : "Routine Management"}
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            {user.role === "member"
              ? "Your current semester class schedule loaded from the database. Upload a new UCAM XLSX to update anytime."
              : "Members must upload their class schedule each semester before the deadline."
            }
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={fetchSchedule} disabled={loading}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw size={24} className="mx-auto mb-2 text-muted-foreground animate-spin" />
            <p className="text-xs text-muted-foreground">Loading your class schedule from database...</p>
          </div>
        ) : schedule.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-success/10 border border-success/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20 text-success">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Routine Synced Active</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {schedule.length} total class slots · {theoryCount} theory · {labCount} lab{labCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onUploadRoutine}>
                <Upload size={12} /> Update Routine
              </Button>
            </div>

            {/* Daily schedule breakdown */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Class Schedule by Day ({groupedByDay.length} Active Days)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupedByDay.map(({ day, slots }) => (
                  <div key={day} className="p-3 rounded-xl border border-border bg-card/60 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                      <Badge variant="outline" className="font-semibold text-xs px-2.5 py-0.5">
                        {day}
                      </Badge>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {slots.length} class{slots.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {slots.map((slot, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/60 text-xs">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{slot.course}</p>
                            {slot.room && (
                              <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                <span>Room:</span> {slot.room}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                            {slot.startTime}–{slot.endTime}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle size={16} />
              <p className="text-sm font-semibold">No Routine Uploaded Yet</p>
            </div>
            <p className="text-xs text-muted-foreground">
              You have not uploaded a class routine for this semester. Upload your UIU UCAM XLSX routine below to calculate your real-time availability.
            </p>
          </div>
        )}

        {/* Upload box */}
        <div
          className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onUploadRoutine}
        >
          <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Upload or Update UCAM XLSX</p>
          <p className="text-xs text-muted-foreground mt-0.5">Drag and drop your spreadsheet or click to browse</p>
          <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={e => { e.stopPropagation(); onUploadRoutine() }}>
            Browse File
          </Button>
        </div>

        <div className="p-3 rounded-lg bg-muted flex items-start gap-2.5">
          <Clock size={14} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-foreground">Automatic Routine Parser</p>
            <p className="text-muted-foreground mt-0.5">
              Supports UIU UCAM RptStudentClassRoutine.xlsx spreadsheets with Saturday, Sunday, Monday, Tuesday, Wednesday, and Thursday class schedules.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileTab() {
  const { user, updateUser } = useUserCtx()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [whatsapp, setWhatsapp] = useState(user.whatsapp)
  const [team, setTeam] = useState(user.team || "UMRT")
  const [subteam, setSubteam] = useState(user.subteam || "Software")
  const [batch, setBatch] = useState(user.batch || "2024")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Keep state in sync with user
  useEffect(() => {
    setName(user.name)
    setEmail(user.email)
    setWhatsapp(user.whatsapp)
    setTeam(user.team || "UMRT")
    setSubteam(user.subteam || "Software")
    setBatch(user.batch || "2024")
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const updated = await authApi.updateProfile({
        name: name.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        batch,
        team,
        subteam,
      })

      updateUser({
        name: updated.name,
        email: updated.email,
        whatsapp: updated.whatsapp,
        batch: updated.batch,
        team: updated.team,
        subteam: updated.subteam,
        initials: updated.initials,
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to update profile in database.")
    } finally {
      setLoading(false)
    }
  }

  const TEAMS_LIST = ["UMRT", "URRT", "Team XYZ"]
  const SUBTEAMS_LIST = ["Software", "Electrical", "Mechanical", "Communication", "Science", "Media", "UI/UX"]
  const BATCHES_LIST = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"]

  return (
    <TabsContent value="profile" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Profile</CardTitle>
          <CardDescription>View and edit your personal information. Changes persist immediately in the database.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Header info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="text-lg bg-primary text-primary-foreground font-semibold">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground truncate">{user.name}</h3>
                  <Badge variant="outline" className="text-xs font-medium">
                    {roleLabel(user.role)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                  <Lock size={11} /> Role is fixed to <span className="font-medium text-foreground">{roleLabel(user.role)}</span> (cannot be changed directly).
                </p>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Full Name</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Work Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@cairlab.org"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">WhatsApp Number</label>
                <Input
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="8801..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Batch</label>
                <Select value={batch} onValueChange={setBatch}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BATCHES_LIST.map(b => (
                      <SelectItem key={b} value={b} className="text-xs">Batch {b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Assigned Team</label>
                <Select value={team} onValueChange={setTeam}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS_LIST.map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Assigned Subteam</label>
                <Select value={subteam} onValueChange={setSubteam}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select subteam" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBTEAMS_LIST.map(st => (
                      <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium">
                {error}
              </div>
            )}

            {saved && (
              <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-success text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Profile changes saved to database successfully!
              </div>
            )}

            <Separator />

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving changes...</>
                ) : saved ? (
                  <><CheckCircle2 size={14} /> Saved</>
                ) : (
                  <><Save size={14} /> Save Profile Changes</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

function AccountTab() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await authApi.deleteAccount()
      window.location.reload()
    } catch (e) {
      alert("Failed to delete account.")
      setLoading(false)
    }
  }

  return (
    <TabsContent value="account" className="mt-4">
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>Permanently delete your account and remove all data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Delete Account</h4>
              <p className="text-xs text-muted-foreground mt-1">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
              <Button variant="destructive" onClick={() => setShowConfirm(true)}>Delete Account</Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                    {loading ? "Deleting..." : "Yes, delete account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

// ─── Projects & Kanban Board Page ──────────────────────────────────────────────

type KanbanStatus = "Backlog" | "To Do" | "In Progress" | "Review" | "Testing" | "Completed"
type KanbanPriority = "Low" | "Medium" | "High" | "Critical"

interface KanbanProject {
  id: string
  name: string
  color: string
  description: string
  createdAt: string
}

interface KanbanTask {
  id: string
  projectId: string
  title: string
  description: string
  status: KanbanStatus
  priority: KanbanPriority
  assignee: string
  due: string
  tags: string[]
  createdAt: string
}

const KANBAN_COLUMNS: { id: KanbanStatus; label: string; color: string; bg: string; border: string }[] = [
  { id: "Backlog", label: "Backlog", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
  { id: "To Do", label: "To Do", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { id: "In Progress", label: "In Progress", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { id: "Review", label: "Review", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { id: "Testing", label: "Testing", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { id: "Completed", label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
]

const PRIORITY_STYLES: Record<KanbanPriority, { label: string; dot: string; text: string }> = {
  Low: { label: "Low", dot: "bg-slate-400", text: "text-slate-400" },
  Medium: { label: "Medium", dot: "bg-blue-400", text: "text-blue-400" },
  High: { label: "High", dot: "bg-amber-400", text: "text-amber-400" },
  Critical: { label: "Critical", dot: "bg-red-500", text: "text-red-400" },
}

const PROJECT_PALETTE = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#fb923c", "#34d399"]

const DEFAULT_PROJECTS: KanbanProject[] = [
  { id: "proj-1", name: "Rover Control System", description: "Core telemetry, obstacle avoidance, and navigation modules", color: "#6366f1", createdAt: new Date().toISOString() },
  { id: "proj-2", name: "Hardware Integration", description: "PCB design, power distribution, and mechanical assembly", color: "#f59e0b", createdAt: new Date().toISOString() },
  { id: "proj-3", name: "Autonomous Navigation", description: "Computer vision and path planning pipeline", color: "#10b981", createdAt: new Date().toISOString() },
]

const DEFAULT_TASKS: KanbanTask[] = [
  { id: "t-1", projectId: "proj-1", title: "Autonomous Navigation Module", description: "Implement obstacle avoidance using LiDAR sensor and ROS2 pipelines", status: "In Progress", priority: "High", assignee: "Lead Dev", due: "Aug 15", tags: ["ROS2", "Python", "LiDAR"], createdAt: new Date().toISOString() },
  { id: "t-2", projectId: "proj-2", title: "PCB Power Distribution Rail", description: "Design 12V / 5V dual rail step-down buck converter", status: "To Do", priority: "Critical", assignee: "Electrical Team", due: "Aug 20", tags: ["PCB", "KiCad", "Power"], createdAt: new Date().toISOString() },
  { id: "t-3", projectId: "proj-2", title: "Chassis Stress Simulation", description: "Run FEA load analysis on rover chassis joints", status: "Completed", priority: "Medium", assignee: "Mechanical Team", due: "Aug 02", tags: ["CAD", "FEA"], createdAt: new Date().toISOString() },
  { id: "t-4", projectId: "proj-1", title: "Real-Time Telemetry Stream", description: "Stream live IMU and motor velocity over WebSocket to frontend dashboard", status: "To Do", priority: "High", assignee: "Software Lead", due: "Aug 28", tags: ["WebSocket", "Node.js"], createdAt: new Date().toISOString() },
  { id: "t-5", projectId: "proj-3", title: "Unit Tests for Path Planner", description: "Write comprehensive pytest suite for Dijkstra and A* path algorithms", status: "Backlog", priority: "Low", assignee: "QA Team", due: "Sep 05", tags: ["pytest", "Testing"], createdAt: new Date().toISOString() },
  { id: "t-6", projectId: "proj-3", title: "Computer Vision Camera Stream", description: "Calibrate stereo camera and stereo disparity map for depth estimation", status: "Review", priority: "High", assignee: "Vision Team", due: "Aug 18", tags: ["OpenCV", "CUDA"], createdAt: new Date().toISOString() },
  { id: "t-7", projectId: "proj-2", title: "Battery Management System QA", description: "Thermal testing during 10A continuous discharge load cycle", status: "Testing", priority: "Critical", assignee: "Hardware Lead", due: "Aug 12", tags: ["BMS", "Safety"], createdAt: new Date().toISOString() },
]

function loadStoredKanban(userId: string) {
  try {
    const raw = localStorage.getItem(`kanban_data_${userId}`) || localStorage.getItem("kanban_data_global")
    if (raw) return JSON.parse(raw) as { projects: KanbanProject[]; tasks: KanbanTask[] }
  } catch { }
  return null
}

function saveStoredKanban(userId: string, projects: KanbanProject[], tasks: KanbanTask[]) {
  try {
    const payload = JSON.stringify({ projects, tasks })
    localStorage.setItem(`kanban_data_${userId}`, payload)
    localStorage.setItem("kanban_data_global", payload)
  } catch { }
}

function ProjectsPage() {
  const user = useUser()
  const stored = loadStoredKanban(user.id)

  const isManager = user.role === "org-owner" || user.role === "team-manager"

  const [projects, setProjects] = useState<KanbanProject[]>(() => stored?.projects || DEFAULT_PROJECTS)
  const [tasks, setTasks] = useState<KanbanTask[]>(() => stored?.tasks || DEFAULT_TASKS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeProject, setActiveProject] = useState<string>("all")
  const [memberFilter, setMemberFilter] = useState<string>("all")
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<KanbanStatus | null>(null)
  const [dragOverPrio, setDragOverPrio] = useState<KanbanPriority | null>(null)
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: KanbanTask | null; column?: KanbanStatus }>({ open: false, task: null })
  const [projectModal, setProjectModal] = useState<{ open: boolean; project: KanbanProject | null }>({ open: false, project: null })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [saving, setSaving] = useState(false)

  // ── Sync to localStorage on any state update ──
  useEffect(() => {
    saveStoredKanban(user.id, projects, tasks)
  }, [projects, tasks, user.id])

  // ── Load data from API with graceful fallback ──
  const loadData = async () => {
    try {
      setError(null)
      const [rawProjects, rawTasks] = await Promise.all([
        projectsApi.getProjects().catch(() => null),
        projectsApi.getAllTasks().catch(() => null),
      ])
      if (Array.isArray(rawProjects) && rawProjects.length > 0) {
        setProjects(rawProjects.map(apiToProject))
      }
      if (Array.isArray(rawTasks) && rawTasks.length > 0) {
        setTasks(rawTasks.map(apiToTask))
      }
    } catch {
      // Gracefully fall back to local state
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Serializers ──
  function apiToProject(p: any): KanbanProject {
    return { id: p.id, name: p.name, description: p.description ?? "", color: p.color ?? "#6366f1", createdAt: p.createdAt }
  }
  function apiToTask(t: any): KanbanTask {
    return {
      id: t.id, projectId: t.projectId, title: t.title, description: t.description ?? "",
      status: t.status as KanbanStatus, priority: t.priority as KanbanPriority,
      assignee: t.assigneeLabel || t.createdByName || user.name || "Member",
      due: t.due ?? "", tags: t.tags ?? [],
      createdAt: t.createdAt,
    }
  }

  // Unique assignees for supervisor filter
  const uniqueAssignees = Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean)))

  // Filter tasks based on project tab and supervisor member filter
  const filteredTasks = tasks.filter(t => {
    const matchesProj = activeProject === "all" || t.projectId === activeProject
    const matchesMember = memberFilter === "all" || t.assignee === memberFilter
    return matchesProj && matchesMember
  })

  // ── Drag & Drop Column Status (Managers only) ──
  const onDragStart = (e: React.DragEvent, taskId: string) => {
    if (!isManager) return
    setDragTaskId(taskId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", taskId)
  }

  const onDragOver = (e: React.DragEvent, col: KanbanStatus) => {
    if (!isManager) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(col)
  }

  const onDrop = async (e: React.DragEvent, col: KanbanStatus) => {
    if (!isManager) return
    e.preventDefault()
    if (!dragTaskId) return
    const original = tasks.find(t => t.id === dragTaskId)
    if (!original || original.status === col) {
      setDragTaskId(null); setDragOver(null); setDragOverPrio(null); return
    }
    // Optimistic update
    const currentId = dragTaskId
    setTasks(prev => prev.map(t => t.id === currentId ? { ...t, status: col } : t))
    setDragTaskId(null); setDragOver(null); setDragOverPrio(null)
    projectsApi.updateTask(currentId, { status: col }).catch(() => { })
  }

  // ── Drag & Drop Priority Drop Target (Managers only) ──
  const onDropPriority = async (e: React.DragEvent, prio: KanbanPriority) => {
    if (!isManager) return
    e.preventDefault()
    if (!dragTaskId) return
    const original = tasks.find(t => t.id === dragTaskId)
    if (!original || original.priority === prio) {
      setDragTaskId(null); setDragOver(null); setDragOverPrio(null); return
    }
    const currentId = dragTaskId
    setTasks(prev => prev.map(t => t.id === currentId ? { ...t, priority: prio } : t))
    setDragTaskId(null); setDragOver(null); setDragOverPrio(null)
    projectsApi.updateTask(currentId, { priority: prio }).catch(() => { })
  }

  const onDragEnd = () => { setDragTaskId(null); setDragOver(null); setDragOverPrio(null) }

  // ── 1-Click Priority Cycle (Managers only) ──
  const cyclePriority = async (e: React.MouseEvent, task: KanbanTask) => {
    e.stopPropagation()
    if (!isManager) return
    const priorities: KanbanPriority[] = ["Low", "Medium", "High", "Critical"]
    const nextIdx = (priorities.indexOf(task.priority) + 1) % priorities.length
    const nextPrio = priorities[nextIdx]
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: nextPrio } : t))
    projectsApi.updateTask(task.id, { priority: nextPrio }).catch(() => { })
  }

  // ── Quick Column Progression (Managers only) ──
  const moveTaskColumn = async (e: React.MouseEvent, task: KanbanTask, direction: "prev" | "next") => {
    e.stopPropagation()
    if (!isManager) return
    const colIds: KanbanStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Testing", "Completed"]
    const currentIdx = colIds.indexOf(task.status)
    const newIdx = direction === "next" ? Math.min(currentIdx + 1, colIds.length - 1) : Math.max(currentIdx - 1, 0)
    if (newIdx === currentIdx) return
    const newStatus = colIds[newIdx]
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    projectsApi.updateTask(task.id, { status: newStatus }).catch(() => { })
  }

  // ── Task CRUD ──
  const saveTask = async (task: KanbanTask) => {
    if (!isManager) return
    setSaving(true)
    try {
      const isExisting = tasks.find(t => t.id === task.id)
      if (isExisting) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...task } : t))
        projectsApi.updateTask(task.id, {
          title: task.title, description: task.description, status: task.status,
          priority: task.priority, assigneeLabel: task.assignee, due: task.due, tags: task.tags,
        }).then(updated => {
          if (updated?.id) setTasks(prev => prev.map(t => t.id === task.id ? apiToTask(updated) : t))
        }).catch(() => { })
      } else {
        const newTask: KanbanTask = {
          ...task,
          id: task.id || "t-" + Date.now(),
          projectId: task.projectId || (activeProject !== "all" ? activeProject : (projects[0]?.id || "proj-1")),
          assignee: task.assignee || user.name || "Member",
          createdAt: new Date().toISOString(),
        }
        setTasks(prev => [...prev, newTask])
        projectsApi.createTask(newTask.projectId, {
          title: newTask.title, description: newTask.description, status: newTask.status,
          priority: newTask.priority, assigneeLabel: newTask.assignee, due: newTask.due, tags: newTask.tags,
        }).then(created => {
          if (created?.id) setTasks(prev => prev.map(t => t.id === newTask.id ? apiToTask(created) : t))
        }).catch(() => { })
      }
      setTaskModal({ open: false, task: null })
    } finally { setSaving(false) }
  }

  const deleteTask = async (id: string) => {
    if (!isManager) return
    setTasks(prev => prev.filter(t => t.id !== id))
    setConfirmDelete(null)
    setTaskModal({ open: false, task: null })
    projectsApi.deleteTask(id).catch(() => { })
  }

  // ── Project CRUD ──
  const saveProject = async (proj: KanbanProject) => {
    if (!isManager) return
    setSaving(true)
    try {
      const isExisting = projects.find(p => p.id === proj.id)
      if (isExisting) {
        setProjects(prev => prev.map(p => p.id === proj.id ? { ...proj } : p))
        projectsApi.updateProject(proj.id, { name: proj.name, description: proj.description, color: proj.color })
          .then(updated => { if (updated?.id) setProjects(prev => prev.map(p => p.id === proj.id ? apiToProject(updated) : p)) })
          .catch(() => { })
      } else {
        const newProj: KanbanProject = {
          ...proj,
          id: proj.id || "proj-" + Date.now(),
          color: proj.color || PROJECT_PALETTE[projects.length % PROJECT_PALETTE.length],
          createdAt: new Date().toISOString(),
        }
        setProjects(prev => [...prev, newProj])
        projectsApi.createProject({ name: newProj.name, description: newProj.description, color: newProj.color })
          .then(created => { if (created?.id) setProjects(prev => prev.map(p => p.id === newProj.id ? apiToProject(created) : p)) })
          .catch(() => { })
      }
      setProjectModal({ open: false, project: null })
    } finally { setSaving(false) }
  }

  const deleteProject = async (id: string) => {
    if (!isManager) return
    setProjects(prev => prev.filter(p => p.id !== id))
    setTasks(prev => prev.filter(t => t.projectId !== id))
    if (activeProject === id) setActiveProject("all")
    projectsApi.deleteProject(id).catch(() => { })
  }

  const totalByStatus = (col: KanbanStatus) => filteredTasks.filter(t => t.status === col).length

  return (
    <div className="space-y-5">
      {/* Loading / Error state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs font-medium text-muted-foreground">Syncing Projects & Kanban from database...</p>
          </div>
        </div>
      )}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={loadData}>Retry</Button>
        </div>
      )}

      {!loading && (<>
        {/* Workspace Banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">
              ⚡
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Live Team Kanban Board & Sprint Tracker
                <Badge variant={isManager ? "default" : "secondary"} className="text-[9px] px-1.5 py-0">
                  {isManager ? "Full Manager Control" : "View-Only Mode • Managed by Team Managers"}
                </Badge>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isManager
                  ? "Drag and drop cards across columns, click priority badges to cycle priority, or click cards to edit full details."
                  : "Live engineering board view. Only Organization Owners and Team Managers can modify tasks and sprint statuses."
                }
              </p>
            </div>
          </div>
          {uniqueAssignees.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">Filter Member:</span>
              <Select value={memberFilter} onValueChange={setMemberFilter}>
                <SelectTrigger className="h-7 text-xs w-40 bg-card">
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members ({tasks.length})</SelectItem>
                  {uniqueAssignees.map(a => (
                    <SelectItem key={a} value={a}>{a} ({tasks.filter(t => t.assignee === a).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects & Kanban Board</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track engineering sprints, task priorities, and subteam milestones
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              <button onClick={() => setView("kanban")} className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all", view === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Board</button>
              <button onClick={() => setView("list")} className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all", view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>List</button>
            </div>
            {isManager && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setProjectModal({ open: true, project: null })} disabled={saving}>
                  <Plus size={13} />New Project
                </Button>
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setTaskModal({ open: true, task: null, column: "To Do" })} disabled={saving}>
                  <Plus size={13} />{saving ? "Saving..." : "Add Task"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Priority Drop Target Bar (Visible when dragging a task to allow instant priority drop) */}
        {isManager && dragTaskId && (
          <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3 animate-in fade-in zoom-in duration-150">
            <p className="text-[11px] font-semibold text-primary mb-2 text-center uppercase tracking-wider">
              🎯 Drop onto a Priority Zone or Column Below:
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(["Low", "Medium", "High", "Critical"] as KanbanPriority[]).map(prio => {
                const pStyle = PRIORITY_STYLES[prio]
                const isTarget = dragOverPrio === prio
                return (
                  <div
                    key={prio}
                    onDragOver={(e) => { e.preventDefault(); setDragOverPrio(prio) }}
                    onDragLeave={() => setDragOverPrio(null)}
                    onDrop={(e) => onDropPriority(e, prio)}
                    className={cn(
                      "rounded-lg border p-2 text-center transition-all cursor-pointer",
                      isTarget ? "border-primary bg-primary/20 scale-105 shadow-md ring-2 ring-primary/40" : "border-border/60 bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", pStyle.dot)} />
                      <span className={cn("text-xs font-bold", pStyle.text)}>Set {prio}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Project Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveProject("all")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", activeProject === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60")}
          >
            All Projects
            <span className={cn("ml-1.5 font-mono", activeProject === "all" ? "opacity-70" : "opacity-50")}>{tasks.length}</span>
          </button>
          {projects.map(proj => (
            <div key={proj.id} className="group relative">
              <button
                onClick={() => setActiveProject(proj.id)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5", activeProject === proj.id ? "text-foreground border-transparent shadow-sm" : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60")}
                style={activeProject === proj.id ? { backgroundColor: proj.color + "22", borderColor: proj.color + "55" } : {}}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                {proj.name}
                <span className="font-mono opacity-60 ml-0.5">{tasks.filter(t => t.projectId === proj.id).length}</span>
              </button>
              {isManager && (
                <button
                  onClick={() => setProjectModal({ open: true, project: proj })}
                  className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shadow-xs"
                  title="Edit project"
                >
                  <Pencil size={8} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-6 gap-2">
          {KANBAN_COLUMNS.map(col => (
            <div key={col.id} className={cn("rounded-lg border p-2.5 text-center", col.bg, col.border)}>
              <p className={cn("text-lg font-bold", col.color)}>{totalByStatus(col.id)}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{col.label}</p>
            </div>
          ))}
        </div>

        {view === "kanban" ? (
          /* ─── Kanban Board ─── */
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "480px" }}>
            {KANBAN_COLUMNS.map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.id)
              const isDragTarget = dragOver === col.id
              return (
                <div
                  key={col.id}
                  className={cn(
                    "rounded-xl border flex flex-col transition-all duration-150",
                    col.bg,
                    isDragTarget ? "border-primary scale-[1.02] shadow-xl ring-2 ring-primary/30" : col.border
                  )}
                  style={{ minWidth: "230px", width: "230px", minHeight: "440px" }}
                  onDragOver={e => onDragOver(e, col.id)}
                  onDrop={e => onDrop(e, col.id)}
                  onDragLeave={() => setDragOver(null)}
                >
                  {/* Column header */}
                  <div className={cn("flex items-center justify-between p-3 border-b", col.border)}>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", col.color.replace("text-", "bg-"))} />
                      <span className={cn("text-xs font-bold uppercase tracking-wider", col.color)}>{col.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1">{colTasks.length}</Badge>
                      {isManager && (
                        <button
                          onClick={() => setTaskModal({ open: true, task: null, column: col.id })}
                          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title={`Add task to ${col.label}`}
                        >
                          <Plus size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task cards */}
                  <div className="flex-1 p-2 space-y-2.5 overflow-y-auto">
                    {colTasks.length === 0 && (
                      <div
                        className={cn(
                          "rounded-lg border-2 border-dashed flex items-center justify-center h-24 transition-colors",
                          isDragTarget ? "border-primary/60 bg-primary/10" : "border-border/30"
                        )}
                      >
                        <p className="text-[11px] text-muted-foreground/50 font-medium">
                          {isDragTarget ? "Drop here to move" : "No tasks in " + col.label}
                        </p>
                      </div>
                    )}

                    {colTasks.map(task => {
                      const proj = projects.find(p => p.id === task.projectId)
                      const prio = PRIORITY_STYLES[task.priority]
                      const isBeingDragged = dragTaskId === task.id

                      return (
                        <div
                          key={task.id}
                          draggable={isManager}
                          onDragStart={e => onDragStart(e, task.id)}
                          onDragEnd={onDragEnd}
                          onClick={() => setTaskModal({ open: true, task })}
                          className={cn(
                            "group rounded-xl border bg-card p-3 space-y-2 transition-all select-none shadow-xs hover:shadow-md hover:border-primary/50",
                            isManager ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            isBeingDragged ? "opacity-30 scale-95 border-primary" : "opacity-100 scale-100"
                          )}
                        >
                          {/* Project Badge */}
                          {proj && (
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: proj.color }} />
                              <span className="text-[9px] font-semibold truncate max-w-[140px]" style={{ color: proj.color }}>{proj.name}</span>
                            </div>
                          )}

                          {/* Title & Priority Pill */}
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="text-xs font-semibold text-foreground leading-snug flex-1">{task.title}</p>

                            <button
                              type="button"
                              onClick={(e) => cyclePriority(e, task)}
                              title={isManager ? "Click to cycle priority (Low ➔ Medium ➔ High ➔ Critical)" : "Priority level"}
                              className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold shrink-0 transition-all bg-muted/60 hover:bg-muted",
                                isManager ? "hover:scale-105 active:scale-95 cursor-pointer" : "cursor-default"
                              )}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", prio.dot)} />
                              <span className={prio.text}>{prio.label}</span>
                            </button>
                          </div>

                          {/* Description */}
                          {task.description && (
                            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>
                          )}

                          {/* Tags */}
                          {task.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {task.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 rounded-md bg-muted text-[9px] text-muted-foreground font-medium">{tag}</span>
                              ))}
                            </div>
                          )}

                          {/* Card Footer with Quick Move Arrows & Assignee */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <Avatar className="w-5 h-5">
                                <AvatarFallback className="text-[8px] font-bold bg-primary/20 text-primary">
                                  {task.assignee.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[9px] text-muted-foreground truncate max-w-[85px]" title={task.assignee}>
                                {task.assignee}
                              </span>
                            </div>

                            {/* Quick 1-Click Column Move Arrows (Managers only) */}
                            <div className="flex items-center gap-0.5">
                              {isManager && (
                                <button
                                  type="button"
                                  onClick={(e) => moveTaskColumn(e, task, "prev")}
                                  className="w-4 h-4 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                                  title="Move column left (←)"
                                >
                                  ←
                                </button>
                              )}
                              <span className="text-[8px] font-mono text-muted-foreground">{task.due || "Active"}</span>
                              {isManager && (
                                <button
                                  type="button"
                                  onClick={(e) => moveTaskColumn(e, task, "next")}
                                  className="w-4 h-4 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                                  title="Move column right (→)"
                                >
                                  →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ─── List View ─── */
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-muted-foreground font-medium w-[35%]">Task</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Project</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Priority</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Assignee</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 && (
                  <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">No tasks found</td></tr>
                )}
                {filteredTasks.map((task, i) => {
                  const proj = projects.find(p => p.id === task.projectId)
                  const col = KANBAN_COLUMNS.find(c => c.id === task.status)
                  const prio = PRIORITY_STYLES[task.priority]

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setTaskModal({ open: true, task })}
                      className={cn(
                        "border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/20",
                        i % 2 === 0 ? "" : "bg-muted/10"
                      )}
                    >
                      <td className="p-3">
                        <p className="font-semibold text-foreground">{task.title}</p>
                        {task.description && <p className="text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
                      </td>
                      <td className="p-3">
                        {proj && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.color }} />
                            <span style={{ color: proj.color }} className="font-medium">{proj.name}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", col?.bg, col?.border, col?.color)}>{task.status}</span>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={(e) => cyclePriority(e, task)}
                          className={cn("flex items-center gap-1", isManager ? "cursor-pointer hover:opacity-80" : "cursor-default")}
                          title={isManager ? "Click to cycle priority" : "Priority"}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", prio.dot)} />
                          <span className={cn("font-medium", prio.text)}>{prio.label}</span>
                        </button>
                      </td>
                      <td className="p-3 text-muted-foreground font-medium">{task.assignee}</td>
                      <td className="p-3 font-mono text-muted-foreground">{task.due || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Task Modal ─── */}
        <TaskModal
          open={taskModal.open}
          task={taskModal.task}
          defaultColumn={taskModal.column}
          projects={projects}
          defaultProjectId={activeProject !== "all" ? activeProject : projects[0]?.id || ""}
          currentUser={user.name || "Member"}
          canEdit={isManager}
          onSave={saveTask}
          onDelete={(id) => setConfirmDelete(id)}
          onClose={() => setTaskModal({ open: false, task: null })}
        />

        {/* ─── Project Modal ─── */}
        <ProjectModal
          open={projectModal.open}
          project={projectModal.project}
          canEdit={isManager}
          onSave={saveProject}
          onDelete={(id) => { deleteProject(id); setProjectModal({ open: false, project: null }) }}
          onClose={() => setProjectModal({ open: false, project: null })}
        />

        {/* ─── Delete Confirm Dialog ─── */}
        <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-[380px]">
            <DialogHeader>
              <DialogTitle>Delete Task</DialogTitle>
              <DialogDescription>This action cannot be undone. The task will be permanently deleted from the database.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => confirmDelete && deleteTask(confirmDelete)}>Delete Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>)}
    </div>
  )
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ open, task, defaultColumn, projects, defaultProjectId, currentUser, canEdit, onSave, onDelete, onClose }: {
  open: boolean
  task: KanbanTask | null
  defaultColumn?: KanbanStatus
  projects: KanbanProject[]
  defaultProjectId: string
  currentUser: string
  canEdit: boolean
  onSave: (t: KanbanTask) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const isNew = !task
  const [form, setForm] = useState<KanbanTask>({
    id: "", projectId: defaultProjectId, title: "", description: "",
    status: defaultColumn || "To Do", priority: "Medium", assignee: currentUser,
    due: "", tags: [], createdAt: new Date().toISOString(),
  })
  const [tagInput, setTagInput] = useState("")

  useEffect(() => {
    if (open) {
      if (task) {
        setForm({ ...task })
      } else {
        setForm({
          id: "t-" + Date.now(),
          projectId: defaultProjectId || projects[0]?.id || "",
          title: "", description: "",
          status: defaultColumn || "To Do", priority: "Medium",
          assignee: currentUser, due: "", tags: [],
          createdAt: new Date().toISOString(),
        })
      }
      setTagInput("")
    }
  }, [open, task, defaultColumn, defaultProjectId, currentUser, projects])

  const set = (k: keyof KanbanTask, v: any) => {
    if (!canEdit) return
    setForm(f => ({ ...f, [k]: v }))
  }

  const addTag = () => {
    if (!canEdit) return
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) set("tags", [...form.tags, t])
    setTagInput("")
  }
  const removeTag = (tag: string) => {
    if (!canEdit) return
    set("tags", form.tags.filter(t => t !== tag))
  }

  const handleSave = () => {
    if (!canEdit || !form.title.trim()) return
    onSave({ ...form, title: form.title.trim() })
  }

  const colMeta = KANBAN_COLUMNS.find(c => c.id === form.status)
  const currentProj = projects.find(p => p.id === form.projectId)
  const prioMeta = PRIORITY_STYLES[form.priority]

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isNew ? (
              <><Plus size={16} className="text-primary" />New Task</>
            ) : canEdit ? (
              <><Pencil size={16} className="text-primary" />Edit Task</>
            ) : (
              <><Layers size={16} className="text-primary" />Task Details</>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Task Title {canEdit && <span className="text-destructive">*</span>}</label>
            {canEdit ? (
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="What needs to be done?" className="text-sm font-medium" onKeyDown={e => e.key === "Enter" && handleSave()} />
            ) : (
              <p className="text-sm font-semibold text-foreground bg-muted/30 p-2.5 rounded-md">{form.title}</p>
            )}
          </div>
          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            {canEdit ? (
              <textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Add more details..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            ) : (
              <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-md leading-relaxed">{form.description || "No description provided."}</p>
            )}
          </div>
          {/* Row: Project + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Project</label>
              {canEdit ? (
                <Select value={form.projectId} onValueChange={v => set("projectId", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-8 flex items-center gap-1.5 px-2 rounded-md bg-muted/30 border border-border text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentProj?.color || "#6366f1" }} />
                  <span className="font-medium">{currentProj?.name || "General"}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              {canEdit ? (
                <Select value={form.status} onValueChange={v => set("status", v as KanbanStatus)}>
                  <SelectTrigger className={cn("h-8 text-xs border", colMeta?.border, colMeta?.bg)} style={{ color: "inherit" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_COLUMNS.map(c => (
                      <SelectItem key={c.id} value={c.id}><span className={c.color}>{c.label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className={cn("h-8 flex items-center px-2.5 rounded-md border text-xs font-semibold", colMeta?.bg, colMeta?.border, colMeta?.color)}>
                  {form.status}
                </div>
              )}
            </div>
          </div>
          {/* Row: Priority + Assignee + Due */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              {canEdit ? (
                <Select value={form.priority} onValueChange={v => set("priority", v as KanbanPriority)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Low", "Medium", "High", "Critical"] as KanbanPriority[]).map(p => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-1.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_STYLES[p].dot)} />
                          <span className={PRIORITY_STYLES[p].text}>{p}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-8 flex items-center gap-1.5 px-2 rounded-md bg-muted/30 border border-border text-xs">
                  <span className={cn("w-2 h-2 rounded-full", prioMeta.dot)} />
                  <span className={cn("font-medium", prioMeta.text)}>{prioMeta.label}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assignee</label>
              {canEdit ? (
                <Input value={form.assignee} onChange={e => set("assignee", e.target.value)} placeholder="Name or team" className="h-8 text-xs" />
              ) : (
                <div className="h-8 flex items-center px-2 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground font-medium">
                  {form.assignee || "Unassigned"}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Due Date</label>
              {canEdit ? (
                <Input value={form.due} onChange={e => set("due", e.target.value)} placeholder="e.g. Aug 30" className="h-8 text-xs" />
              ) : (
                <div className="h-8 flex items-center px-2 rounded-md bg-muted/30 border border-border text-xs font-mono text-muted-foreground">
                  {form.due || "—"}
                </div>
              )}
            </div>
          </div>
          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tags</label>
            {canEdit && (
              <div className="flex gap-1.5">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag..." className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} />
                <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={addTag}>Add</Button>
              </div>
            )}
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {form.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground font-medium">
                    {tag}
                    {canEdit && (
                      <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-destructive transition-colors"><X size={9} /></button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 flex-row">
          {canEdit && !isNew && (
            <Button variant="destructive" size="sm" className="mr-auto text-xs" onClick={() => onDelete(form.id)}>Delete</Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs ml-auto" onClick={onClose}>Close</Button>
          {canEdit && (
            <Button size="sm" className="text-xs gap-1.5" onClick={handleSave} disabled={!form.title.trim()}>
              <Save size={12} />{isNew ? "Create Task" : "Save Changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Project Modal ────────────────────────────────────────────────────────────

function ProjectModal({ open, project, canEdit, onSave, onDelete, onClose }: {
  open: boolean
  project: KanbanProject | null
  canEdit: boolean
  onSave: (p: KanbanProject) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const isNew = !project
  const [form, setForm] = useState<KanbanProject>({
    id: "", name: "", color: PROJECT_PALETTE[0], description: "", createdAt: new Date().toISOString(),
  })

  useEffect(() => {
    if (open) {
      if (project) {
        setForm({ ...project })
      } else {
        setForm({ id: "proj-" + Date.now(), name: "", color: PROJECT_PALETTE[0], description: "", createdAt: new Date().toISOString() })
      }
    }
  }, [open, project])

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Create New Project" : "Edit Project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Project Name <span className="text-destructive">*</span></label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rover Navigation System" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={cn("w-7 h-7 rounded-full border-2 transition-all", form.color === c ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 flex-row">
          {!isNew && canEdit && (
            <Button variant="destructive" size="sm" className="mr-auto text-xs" onClick={() => onDelete(form.id)}>Delete</Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
          {canEdit && (
            <Button size="sm" className="text-xs" onClick={() => { if (form.name.trim()) onSave({ ...form, name: form.name.trim() }) }} disabled={!form.name.trim()}>
              {isNew ? "Create Project" : "Save Changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── AI Meeting Planner Page ──────────────────────────────────────────────────

interface SlotRecommendation {
  day: DayOfWeek
  startTime: string
  endTime: string
  freeMembers: Member[]
  conflictingMembers: { member: Member; conflictCourse?: string }[]
  missingRoutineMembers: Member[]
  score: number
  consecutiveFreeBlocks: number
  peakHour: boolean
}

function computeSlotScore(
  freeCount: number,
  missingCount: number,
  conflictCount: number,
  consecutiveFreeBlocks: number,
  peakHour: boolean,
  totalCandidates: number
): number {
  if (totalCandidates === 0) return 0
  const availRatio      = freeCount / totalCandidates
  const missingPenalty  = (missingCount / totalCandidates) * 0.12
  const consecutiveBonus= Math.min(consecutiveFreeBlocks * 0.03, 0.10)
  const peakBonus       = peakHour ? 0.05 : 0
  const raw             = availRatio - missingPenalty + consecutiveBonus + peakBonus
  return Math.round(Math.min(1, Math.max(0, raw)) * 100)
}

function MeetingPlannerPage() {
  const user    = useUser()
  const tScope  = teamScope(user)
  const stScope = subteamScope(user)

  const [title,           setTitle]           = useState("Team Sync & Project Alignment")
  const [duration,        setDuration]        = useState("60")
  const [team,            setTeam]            = useState<string>(tScope  || "all")
  const [subteam,         setSubteam]         = useState<string>(stScope || "all")
  const [skill,           setSkill]           = useState<string>("all")
  const [targetDay,       setTargetDay]       = useState<string>("all")
  const [windowFilter,    setWindowFilter]    = useState<"all"|"morning"|"afternoon"|"evening">("all")
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(0)
  const [scheduleOpen,    setScheduleOpen]    = useState(false)
  const [copied,          setCopied]          = useState(false)
  const [syncStatus,      setSyncStatus]      = useState<string|null>(null)
  const [viewMode,        setViewMode]        = useState<"cards"|"heatmap">("cards")

  const [membersList, setMembersList] = useState<Member[]>([])
  const [teamsList,   setTeamsList]   = useState<{ name: string; subteams: { name: string }[] }[]>([])
  const [skillsList,  setSkillsList]  = useState<string[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      membersApi.getMembers(),
      teamsApi.getTeams(),
      skillsApi.getSkillsCatalog(),
    ]).then(([memsRes, teamsRes, skillsRes]) => {
      setMembersList(memsRes.status  === "fulfilled" && memsRes.value  ? memsRes.value  : [])
      setTeamsList(  teamsRes.status === "fulfilled" && teamsRes.value ? teamsRes.value : [])
      const so = skillsRes.status === "fulfilled" && skillsRes.value ? skillsRes.value : { catalog: [] }
      setSkillsList((so?.catalog || []).map((s: any) => s.name))
    }).finally(() => setLoading(false))
  }, [])

  const availableSubteams = team === "all"
    ? [...new Set(teamsList.flatMap(t => (t.subteams || []).map(s => s.name)))]
    : (teamsList.find(t => t.name === team)?.subteams || []).map(s => s.name)

  const candidatePool = membersList.filter(m => {
    if (team    !== "all" && m.team !== team) return false
    if (subteam !== "all" && !(m.subteams || []).includes(subteam)) return false
    if (skill   !== "all" && !(m.skills   || []).some(s => s.toLowerCase() === skill.toLowerCase())) return false
    return true
  })

  const DAYS: DayOfWeek[] = ["Sat","Sun","Mon","Tue","Wed","Thu","Fri"]
  const ALL_STARTS: string[] = []
  for (let h = 8; h <= 19; h++) {
    ALL_STARTS.push(`${h.toString().padStart(2,"0")}:00`)
    if (h < 19) ALL_STARTS.push(`${h.toString().padStart(2,"0")}:30`)
  }

  const filteredStartTimes = ALL_STARTS.filter(t => {
    const m = timeToMinutes(t)
    if (windowFilter === "morning")   return m >= 8*60  && m < 12*60
    if (windowFilter === "afternoon") return m >= 12*60 && m < 16*60
    if (windowFilter === "evening")   return m >= 16*60 && m <= 19*60
    return true
  })

  const candidateDays: DayOfWeek[] = targetDay !== "all" ? [targetDay as DayOfWeek] : DAYS
  const durationMins = parseInt(duration, 10) || 60

  // Pre-compute per-member per-day 30-min bucket availability (memoised on pool identity)
  const poolKey = candidatePool.map(m => m.id).join(",")
  const memberAvailCache = useMemo(() => {
    const cache: Record<string, boolean[][]> = {}
    for (const m of candidatePool) {
      if (!m.schedule || m.schedule.length === 0) {
        cache[m.id] = DAYS.map(() => ALL_STARTS.map(() => false))
        continue
      }
      cache[m.id] = DAYS.map(day =>
        ALL_STARTS.map(st => {
          const endMins = timeToMinutes(st) + 30
          const endH    = Math.floor(endMins/60), endM = endMins%60
          const endStr  = `${endH.toString().padStart(2,"0")}:${endM.toString().padStart(2,"0")}`
          return isFreeDuringInterval(m.schedule, day, st, endStr).isFree
        })
      )
    }
    return cache
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey])

  const evaluatedSlots: SlotRecommendation[] = useMemo(() => {
    const slots: SlotRecommendation[] = []
    for (const day of candidateDays) {
      const dayIdx = DAYS.indexOf(day)
      for (const st of filteredStartTimes) {
        const startMins = timeToMinutes(st)
        const endMins   = startMins + durationMins
        if (endMins > 20 * 60) continue
        const endH = Math.floor(endMins/60), endM = endMins%60
        const endStr = `${endH.toString().padStart(2,"0")}:${endM.toString().padStart(2,"0")}`

        const freeMembers:            Member[]                                       = []
        const conflictingMembers:     { member: Member; conflictCourse?: string }[]  = []
        const missingRoutineMembers:  Member[]                                       = []

        for (const m of candidatePool) {
          if (!m.schedule || m.schedule.length === 0) { missingRoutineMembers.push(m); continue }
          const check = isFreeDuringInterval(m.schedule, day, st, endStr)
          if (check.isFree) freeMembers.push(m)
          else              conflictingMembers.push({ member: m, conflictCourse: check.conflictCourse })
        }

        // Count adjacent 30-min windows where all routined members are also free
        let consecutiveFreeBlocks = 0
        const bi0 = ALL_STARTS.indexOf(st)
        const routinedPool = candidatePool.filter(m => m.schedule && m.schedule.length > 0)
        for (let delta = -2; delta <= 2; delta++) {
          if (delta === 0) continue
          const bi = bi0 + delta
          if (bi < 0 || bi >= ALL_STARTS.length) continue
          if (routinedPool.every(m => memberAvailCache[m.id]?.[dayIdx]?.[bi] === true))
            consecutiveFreeBlocks++
        }

        const peakHour = (startMins >= 16*60 && startMins <= 19*60) || (startMins >= 8*60 && startMins < 10*60)
        const score    = computeSlotScore(freeMembers.length, missingRoutineMembers.length, conflictingMembers.length, consecutiveFreeBlocks, peakHour, candidatePool.length)

        slots.push({ day, startTime: st, endTime: endStr, freeMembers, conflictingMembers, missingRoutineMembers, score, consecutiveFreeBlocks, peakHour })
      }
    }
    slots.sort((a, b) => b.score - a.score || b.freeMembers.length - a.freeMembers.length || (b.peakHour ? 1 : -1))
    return slots
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberAvailCache, candidateDays.join(","), filteredStartTimes.join(","), durationMins])

  const topSlots    = evaluatedSlots.slice(0, 6)
  const currentSlot = topSlots[selectedSlotIdx] ?? topSlots[0]

  // Weekly heatmap: pct of members free per day × 2-hr window
  const heatmapData = useMemo(() => {
    const windows = [
      { label: "8–10 AM",  range: [8*60,  10*60] },
      { label: "10–12 PM", range: [10*60, 12*60] },
      { label: "12–2 PM",  range: [12*60, 14*60] },
      { label: "2–4 PM",   range: [14*60, 16*60] },
      { label: "4–6 PM",   range: [16*60, 18*60] },
      { label: "6–8 PM",   range: [18*60, 20*60] },
    ]
    const routinedPool = candidatePool.filter(m => m.schedule && m.schedule.length > 0)
    return DAYS.map(day => {
      const dayIdx = DAYS.indexOf(day)
      return {
        day,
        windows: windows.map(w => {
          const buckets = ALL_STARTS.filter(t => { const m = timeToMinutes(t); return m >= w.range[0] && m < w.range[1] })
          if (!buckets.length || !routinedPool.length) return { label: w.label, pct: 0 }
          let free = 0
          for (const m of routinedPool) for (const st of buckets) {
            const bi = ALL_STARTS.indexOf(st)
            if (memberAvailCache[m.id]?.[dayIdx]?.[bi]) free++
          }
          return { label: w.label, pct: Math.round((free / (routinedPool.length * buckets.length)) * 100) }
        })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberAvailCache, poolKey])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const resetFilters = () => { setTeam("all"); setSubteam("all"); setSkill("all"); setTargetDay("all"); setWindowFilter("all"); setSelectedSlotIdx(0) }

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-500" : s >= 60 ? "text-amber-500" : s >= 40 ? "text-orange-500" : "text-rose-500"
  const scoreBg = (s: number) =>
    s >= 80 ? "bg-emerald-500/10 border-emerald-500/30" : s >= 60 ? "bg-amber-400/10 border-amber-400/30" : s >= 40 ? "bg-orange-500/10 border-orange-500/30" : "bg-rose-500/10 border-rose-500/30"
  const scoreBar = (s: number) =>
    s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-400" : s >= 40 ? "bg-orange-400" : "bg-rose-500"
  const heatColor = (pct: number) => {
    if (pct >= 80) return "bg-emerald-500    text-white"
    if (pct >= 60) return "bg-emerald-400/80 text-white"
    if (pct >= 40) return "bg-amber-400/80   text-foreground"
    if (pct >= 20) return "bg-orange-400/70  text-foreground"
    if (pct  >  0) return "bg-rose-400/60    text-foreground"
    return "bg-muted/50 text-muted-foreground"
  }

  const downloadIcsFile = () => {
    if (!currentSlot) return
    const now = new Date()
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RoverBuddies//AI-Scheduler//EN\nCALSCALE:GREGORIAN\nMETHOD:REQUEST\nBEGIN:VEVENT\nUID:rb-${Date.now()}@roverbuddies.local\nDTSTAMP:${now.toISOString().replace(/[-:]/g,"").split(".")[0]}Z\nSUMMARY:${title} – CAIR Lab\nDESCRIPTION:AI Scheduled Meeting\\nScope: ${team !== "all" ? team : "All Teams"}\\nAttendees (${currentSlot.freeMembers.length}): ${currentSlot.freeMembers.map(m => m.name).join(", ")}\nLOCATION:CAIR Lab / Rover Lab\\, UIU\nSTATUS:CONFIRMED\nEND:VEVENT\nEND:VCALENDAR`
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.setAttribute("download", `RoverBuddies_${currentSlot.day}_Meeting.ics`)
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setSyncStatus("iCalendar (.ics) file downloaded!"); setTimeout(() => setSyncStatus(null), 3000)
  }

  const copyInviteText = () => {
    if (!currentSlot) return
    navigator.clipboard.writeText(
      `📅 *RoverBuddies Meeting*\n📌 *Topic:* ${title}\n🕒 *When:* ${currentSlot.day} · ${format12Hour(currentSlot.startTime)}–${format12Hour(currentSlot.endTime)} (BST)\n👥 *Scope:* ${team !== "all" ? team : "All Teams"}${subteam !== "all" ? ` · ${subteam}` : ""}\n📊 *AI Score:* ${currentSlot.score}%\n✅ *Free (${currentSlot.freeMembers.length}):*\n${currentSlot.freeMembers.map(m => `• ${m.name}`).join("\n")}${currentSlot.conflictingMembers.length > 0 ? `\n⚠️ *In Class:* ${currentSlot.conflictingMembers.map(c => c.member.name).join(", ")}` : ""}`
    )
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page Header */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-primary/8 via-card to-card p-5 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles size={14} className="text-primary" />
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">AI-Powered · Dhaka BST UTC+6</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">AI Meeting Scheduler</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Optimal slot recommendations across <strong>{candidatePool.length}</strong> CAIR Lab members' live class routines
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted/60 border border-border">
              {(["cards","heatmap"] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize",
                    viewMode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {m === "cards" ? <><Layers size={11}/> Cards</> : <><BarChart3 size={11}/> Heatmap</>}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={resetFilters}>
              <RefreshCw size={11}/> Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* ── Config Panel ── */}
        <div className="col-span-1 space-y-3">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Zap size={13} className="text-primary"/> Config</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Meeting Title</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rover Sprint Review" className="text-sm h-8"/>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Team</label>
                  <Select value={team} onValueChange={v => { setTeam(v); setSubteam("all"); setSelectedSlotIdx(0) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {teamsList.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subteam</label>
                  <Select value={subteam} onValueChange={v => { setSubteam(v); setSelectedSlotIdx(0) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {availableSubteams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Duration</label>
                  <Select value={duration} onValueChange={v => { setDuration(v); setSelectedSlotIdx(0) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {[["15","15 min"],["30","30 min"],["45","45 min"],["60","1 hr"],["90","1.5 hr"],["120","2 hr"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Day</label>
                  <Select value={targetDay} onValueChange={v => { setTargetDay(v); setSelectedSlotIdx(0) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Day</SelectItem>
                      {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Time Window</label>
                <div className="grid grid-cols-2 gap-1">
                  {(["all","morning","afternoon","evening"] as const).map(w => (
                    <button key={w} onClick={() => { setWindowFilter(w); setSelectedSlotIdx(0) }}
                      className={cn("rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all capitalize",
                        windowFilter === w ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                      {w === "all" ? "All Day" : w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Skill Required</label>
                <Select value={skill} onValueChange={v => { setSkill(v); setSelectedSlotIdx(0) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any Skill"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Skill</SelectItem>
                    {skillsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Audience chip */}
          <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users size={14} className="text-primary"/>
            </div>
            <div>
              <p className="text-lg font-black text-foreground leading-none">{candidatePool.length}</p>
              <p className="text-[11px] text-muted-foreground">members in scope</p>
            </div>
          </div>

          {candidatePool.filter(m => !m.schedule || !m.schedule.length).length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex gap-2 text-xs text-muted-foreground">
              <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5"/>
              <span><strong className="text-foreground">{candidatePool.filter(m => !m.schedule || !m.schedule.length).length}</strong> members have no routine — marked as uncertain</span>
            </div>
          )}
        </div>

        {/* ── Results Panel ── */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles size={26} className="text-primary animate-pulse"/>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-ping opacity-60"/>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">AI computing optimal windows…</p>
                <p className="text-xs text-muted-foreground mt-1">Analysing {membersList.length} members across {DAYS.length * ALL_STARTS.length} time slots</p>
              </div>
            </div>

          ) : candidatePool.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <Users size={42} className="text-muted-foreground/25"/>
              <p className="text-sm font-bold text-foreground">No members match current filters</p>
              <p className="text-xs text-muted-foreground">Try resetting the team, subteam, or skill criteria</p>
              <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={resetFilters}><RefreshCw size={12}/> Reset Filters</Button>
            </div>

          ) : viewMode === "heatmap" ? (
            <Card className="border-border shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><BarChart3 size={13} className="text-primary"/> Weekly Availability Heatmap</CardTitle>
                <CardDescription className="text-xs">Percentage of members free across each day × 2-hour window. Click a cell to see details.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 min-w-[480px] text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-muted-foreground font-bold pb-1 w-10"/>
                      {heatmapData[0].windows.map(w => (
                        <th key={w.label} className="text-center text-muted-foreground font-semibold pb-1 whitespace-nowrap px-1">{w.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.map(row => (
                      <tr key={row.day}>
                        <td className="font-black text-foreground pr-1 py-0.5">{row.day}</td>
                        {row.windows.map(w => (
                          <td key={w.label} className="px-0.5 py-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn("rounded-lg text-center font-bold py-3 select-none transition-transform hover:scale-105 cursor-pointer", heatColor(w.pct))}>
                                  {w.pct}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">{row.day} {w.label}: {w.pct}% of members available</TooltipContent>
                            </Tooltip>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border/50">
                  <span className="text-[11px] font-semibold text-muted-foreground">Legend:</span>
                  {[["≥80%","bg-emerald-500"],["60–79%","bg-emerald-400/80"],["40–59%","bg-amber-400/80"],["20–39%","bg-orange-400/70"],["<20%","bg-rose-400/60"],["N/A","bg-muted/50"]].map(([l,c]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className={cn("w-3 h-3 rounded", c)}/><span className="text-[10px] text-muted-foreground">{l}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          ) : topSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <AlertCircle size={38} className="text-warning/60"/>
              <p className="text-sm font-bold text-foreground">No available windows found</p>
              <p className="text-xs text-muted-foreground">Try a shorter duration or expand the time window</p>
              <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={resetFilters}><RefreshCw size={12}/> Reset Filters</Button>
            </div>

          ) : (
            <>
              {/* ── Best Slot Spotlight ── */}
              {currentSlot && (
                <div className={cn("rounded-2xl border p-5 sm:p-6 transition-all", scoreBg(currentSlot.score))}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1", scoreColor(currentSlot.score))}>
                          <TrendingUp size={11}/> #{selectedSlotIdx+1} AI Best Slot
                        </span>
                        {currentSlot.peakHour && (
                          <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-primary/30 text-primary font-mono">⚡ Prime Hour</Badge>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                        {currentSlot.day} · {format12Hour(currentSlot.startTime)} – {format12Hour(currentSlot.endTime)}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">{duration} min · Dhaka BST · {currentSlot.consecutiveFreeBlocks} adjacent free windows</p>
                    </div>
                    {/* Score Dial */}
                    <div className={cn("flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 shrink-0", scoreBg(currentSlot.score))}>
                      <p className={cn("text-2xl font-black leading-none", scoreColor(currentSlot.score))}>{currentSlot.score}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">AI Score</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      { val: currentSlot.freeMembers.length,           label: "Free",      dot: "bg-emerald-500", cls: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/25" },
                      { val: currentSlot.conflictingMembers.length,     label: "In Class",  dot: "bg-rose-500",    cls: "text-rose-500",    bg: "bg-rose-500/10   border-rose-500/25"    },
                      { val: currentSlot.missingRoutineMembers.length,  label: "Unknown",   dot: "bg-muted-foreground", cls: "text-muted-foreground", bg: "bg-muted/60 border-border"   },
                    ].map(s => (
                      <div key={s.label} className={cn("rounded-xl border p-2.5 text-center", s.bg)}>
                        <p className={cn("text-2xl font-black", s.cls)}>{s.val}</p>
                        <p className={cn("text-[10px] font-bold uppercase tracking-wide", s.cls)}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>{currentSlot.freeMembers.length} of {candidatePool.length} members available</span>
                      <span className={cn("font-bold", scoreColor(currentSlot.score))}>{currentSlot.score}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", scoreBar(currentSlot.score))} style={{ width: `${currentSlot.score}%` }}/>
                    </div>
                  </div>

                  {/* Members */}
                  {currentSlot.freeMembers.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500"/> Free Members</p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {currentSlot.freeMembers.map(m => (
                          <Badge key={m.id} variant="secondary" className="text-[11px] py-0.5 px-2 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>
                            {m.name.split(" ").slice(0,2).join(" ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentSlot.conflictingMembers.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><XCircle size={11} className="text-rose-500"/> Class Conflicts</p>
                      <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                        {currentSlot.conflictingMembers.map(c => (
                          <Badge key={c.member.id} variant="outline" className="text-[11px] py-0.5 px-2 gap-1 border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"/>
                            {c.member.name.split(" ").slice(0,2).join(" ")}
                            {c.conflictCourse && <span className="text-rose-500/70 text-[9px]">({c.conflictCourse})</span>}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/30">
                    <Button className="flex-1 min-w-36 gap-2" onClick={() => setScheduleOpen(true)}>
                      <Calendar size={14}/> Export & Schedule
                    </Button>
                    <Button variant="outline" className="gap-1.5" onClick={copyInviteText}>
                      {copied ? <><CheckCircle2 size={13} className="text-emerald-500"/> Copied!</> : <>Copy Invite</>}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Alternative Slot Cards ── */}
              {topSlots.length > 1 && (
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Clock size={10}/> All Recommended Windows
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {topSlots.map((slot, idx) => (
                      <button key={`${slot.day}-${slot.startTime}`} onClick={() => setSelectedSlotIdx(idx)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all hover:shadow-sm",
                          selectedSlotIdx === idx
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                            : "border-border bg-card hover:border-primary/40"
                        )}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-foreground">{slot.day}</span>
                          {idx === 0 && <span className="text-[8px] font-bold text-primary bg-primary/15 px-1 rounded">BEST</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{format12Hour(slot.startTime)}</p>
                        <p className="text-[10px] text-muted-foreground">–{format12Hour(slot.endTime)}</p>
                        <div className="mt-1.5 w-full h-1 bg-muted/60 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", scoreBar(slot.score))} style={{ width: `${slot.score}%` }}/>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[9px] text-muted-foreground">{slot.freeMembers.length}/{candidatePool.length} free</p>
                          <p className={cn("text-[10px] font-bold", scoreColor(slot.score))}>{slot.score}%</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Calendar Export Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
              <Calendar size={20}/>
            </div>
            <DialogTitle className="text-base font-bold">Export & Schedule Meeting</DialogTitle>
            <DialogDescription className="text-xs">Download .ics file or open directly in Google Calendar.</DialogDescription>
          </DialogHeader>
          {currentSlot && (
            <div className="space-y-3 pt-1">
              <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-bold text-foreground text-sm">{title}</p>
                <p>📅 <strong>When:</strong> {currentSlot.day} · {format12Hour(currentSlot.startTime)}–{format12Hour(currentSlot.endTime)} (BST)</p>
                <p>👥 <strong>Scope:</strong> {team !== "all" ? team : "All Teams"}{subteam !== "all" ? ` · ${subteam}` : ""}</p>
                <p>✅ <strong>Attendance:</strong> {currentSlot.freeMembers.length}/{candidatePool.length} free ({currentSlot.score}% AI score)</p>
              </div>
              {syncStatus && (
                <p className="text-xs font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg flex items-center gap-1.5">
                  <CheckCircle2 size={13}/> {syncStatus}
                </p>
              )}
              <Button className="w-full gap-2" onClick={downloadIcsFile}><Upload size={13} className="rotate-180"/> Download .ics File</Button>
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title + " – CAIR Lab")}&details=${encodeURIComponent("AI-Scheduled via RoverBuddies\nAttendees: " + currentSlot.freeMembers.map(m => m.name).join(", "))}&location=CAIR+Lab+UIU`} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={13}/> Open in Google Calendar
                </a>
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setScheduleOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


// ─── Portfolio Page ───────────────────────────────────────────────────────────

function PortfolioPage() {
  const user = useUser()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      projectsApi.getProjects(),
      projectsApi.getAllTasks(),
    ]).then(([projRes, taskRes]) => {
      const projs = projRes.status === "fulfilled" && projRes.value ? projRes.value : []
      const ts = taskRes.status === "fulfilled" && taskRes.value ? taskRes.value : []
      setProjects(projs)
      setTasks(ts)
    }).finally(() => setLoading(false))
  }, [])

  // Assigned work from Projects & Kanban Board
  const myAssignedTasks = tasks.filter(t => {
    if (t.assigneeId && t.assigneeId === user.id) return true
    const label = (t.assigneeLabel || "").toLowerCase()
    const uName = (user.name || "").toLowerCase()
    const uInit = (user.initials || "").toLowerCase()
    const uSub = (user.subteam || "").toLowerCase()
    const uTeam = (user.team || "").toLowerCase()
    return (
      (uName && label.includes(uName)) ||
      (uInit && label === uInit) ||
      (uSub && label.includes(uSub)) ||
      (uTeam && label.includes(uTeam))
    )
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Work History & Living Portfolio</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Verified record of team contributions, completed tasks, and leadership</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="col-span-1">
          <CardContent className="pt-6 space-y-4 text-center">
            <Avatar className="w-20 h-20 mx-auto">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">{user.initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-bold text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <Badge variant="outline" className="text-xs mt-1.5">{roleLabel(user.role)}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-left pt-2 border-t border-border">
              <div className="p-2.5 rounded-lg bg-muted">
                <p className="text-[10px] text-muted-foreground uppercase">Team</p>
                <p className="text-xs font-semibold text-foreground">{user.team}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted">
                <p className="text-[10px] text-muted-foreground uppercase">Subteam</p>
                <p className="text-xs font-semibold text-foreground">{user.subteam}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Contribution History</CardTitle>
                <CardDescription className="text-xs">Projects and verified task completions in CAIR Lab</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {myAssignedTasks.length} Assigned {myAssignedTasks.length === 1 ? "Task" : "Tasks"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="p-4 rounded-xl bg-muted text-xs text-muted-foreground animate-pulse text-center">
                Loading assigned projects & contributions from Kanban board...
              </div>
            ) : myAssignedTasks.length === 0 ? (
              <div className="p-6 rounded-xl bg-muted/60 text-center space-y-1.5">
                <p className="text-sm font-medium text-foreground">No Tasks Assigned Yet</p>
                <p className="text-xs text-muted-foreground">
                  Work items assigned to you from the Projects & Kanban Board will automatically display here.
                </p>
              </div>
            ) : (
              myAssignedTasks.map((t, idx) => {
                const proj = projects.find(p => p.id === t.projectId)
                const isDone = t.status === "Completed"
                const isInProgress = t.status === "In Progress"
                return (
                  <div key={t.id || idx} className="p-3.5 rounded-xl bg-muted border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj?.color || "#6366f1" }} />
                        <p className="text-sm font-semibold text-foreground">{t.title}</p>
                      </div>
                      <Badge variant={isDone ? "success" : isInProgress ? "warning" : "secondary"} className="text-[10px]">
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {proj?.name || "Rover Control System"} · Priority: <span className="font-medium text-foreground">{t.priority}</span> · Assigned: <span className="font-medium text-foreground">{t.assigneeLabel || user.name}</span>
                    </p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground/90 line-clamp-2">{t.description}</p>
                    )}
                    {t.tags && t.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {t.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Routine Upload Dialog ───────────────────────────────────────────────────

function RoutineUploadDialog({ open, onOpenChange, onSuccess }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<"upload" | "custom">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Custom Slot Form
  const [customDay, setCustomDay] = useState<DayOfWeek>("Sun")
  const [customStart, setCustomStart] = useState("09:00")
  const [customEnd, setCustomEnd] = useState("10:30")
  const [customTitle, setCustomTitle] = useState("")
  const [customRoom, setCustomRoom] = useState("")
  const [addingSlot, setAddingSlot] = useState(false)
  const [mySlots, setMySlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const loadMyRoutine = () => {
    setLoadingSlots(true)
    routinesApi.getMyRoutine()
      .then(res => setMySlots(res || []))
      .catch(() => setMySlots([]))
      .finally(() => setLoadingSlots(false))
  }

  useEffect(() => {
    if (open) {
      loadMyRoutine()
      setError(null)
      setSuccess(null)
    }
  }, [open])

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
      setSuccess(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setError(null)
      setSuccess(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a UCAM XLSX file first.")
      return
    }
    try {
      setUploading(true)
      setError(null)
      const res = await routinesApi.uploadRoutine(file)
      setSuccess(res.message || "Routine uploaded and availability updated successfully!")
      loadMyRoutine()
      setTimeout(() => {
        setFile(null)
        setSuccess(null)
        onOpenChange(false)
        if (onSuccess) onSuccess()
      }, 1500)
    } catch (err: any) {
      setError(err.message || "Failed to upload routine file.")
    } finally {
      setUploading(false)
    }
  }

  const handleAddCustomSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customTitle.trim()) {
      setError("Please specify a course name or occasion title.")
      return
    }

    try {
      setAddingSlot(true)
      setError(null)
      const res = await routinesApi.addCustomSlot({
        day: customDay,
        startTime: customStart,
        endTime: customEnd,
        course: customTitle.trim(),
        room: customRoom.trim() || undefined,
      })
      setSuccess(res.message || "Custom time slot added successfully!")
      setCustomTitle("")
      setCustomRoom("")
      loadMyRoutine()
      if (onSuccess) onSuccess()
      setTimeout(() => setSuccess(null), 2500)
    } catch (err: any) {
      setError(err.message || "Failed to add custom slot.")
    } finally {
      setAddingSlot(false)
    }
  }

  const handleDeleteSlot = async (id: string) => {
    try {
      setError(null)
      await routinesApi.deleteSlot(id)
      setMySlots(prev => prev.filter(s => s.id !== id))
      setSuccess("Time slot removed.")
      if (onSuccess) onSuccess()
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(err.message || "Failed to delete slot.")
    }
  }

  const handleClose = (o: boolean) => {
    if (!uploading && !addingSlot) {
      setFile(null)
      setError(null)
      setSuccess(null)
      onOpenChange(o)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Routine & Availability Management</DialogTitle>
          <DialogDescription>
            Upload your UCAM class routine or add custom busy time slots for urgent work and special occasions.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switch */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg mt-1">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "upload" ? "default" : "ghost"}
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => { setActiveTab("upload"); setError(null); setSuccess(null) }}
          >
            <Upload size={13} /> Upload UCAM XLSX
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "custom" ? "default" : "ghost"}
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => { setActiveTab("custom"); setError(null); setSuccess(null) }}
          >
            <Clock size={13} /> Custom Slots & Exceptions ({mySlots.length})
          </Button>
        </div>

        {error && (
          <p className="text-xs font-medium text-destructive bg-destructive/10 p-2.5 rounded-lg">
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs font-medium text-success bg-success/10 p-2.5 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 size={14} /> {success}
          </p>
        )}

        {activeTab === "upload" ? (
          <div className="py-3 space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectFile}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <div
              className={cn(
                "rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors",
                file && "border-primary/50 bg-primary/5"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-primary">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Change File
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Click or drag your UCAM XLSX here</p>
                  <p className="text-xs text-muted-foreground">Courses, days, and times are parsed automatically</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Browse File
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" disabled={uploading} onClick={() => handleClose(false)}>Cancel</Button>
              <Button disabled={!file || uploading} onClick={handleUpload}>
                {uploading ? "Uploading..." : "Upload & Sync"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-2 space-y-4">
            {/* Add custom slot form */}
            <form onSubmit={handleAddCustomSlot} className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus size={13} className="text-primary" /> Add Custom Busy Slot / Occasion
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Day</label>
                  <Select value={customDay} onValueChange={(v: any) => setCustomDay(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sat">Saturday</SelectItem>
                      <SelectItem value="Sun">Sunday</SelectItem>
                      <SelectItem value="Mon">Monday</SelectItem>
                      <SelectItem value="Tue">Tuesday</SelectItem>
                      <SelectItem value="Wed">Wednesday</SelectItem>
                      <SelectItem value="Thu">Thursday</SelectItem>
                      <SelectItem value="Fri">Friday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Start Time</label>
                  <Input
                    type="time"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">End Time</label>
                  <Input
                    type="time"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Course / Reason Title</label>
                  <Input
                    placeholder="e.g. Robotics Lab / Thesis Work"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Room / Note (Optional)</label>
                  <Input
                    placeholder="e.g. Lab 402 / Online"
                    value={customRoom}
                    onChange={e => setCustomRoom(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full h-8 text-xs gap-1.5" disabled={addingSlot || !customTitle.trim()}>
                <Plus size={13} /> {addingSlot ? "Adding Slot..." : "Add Custom Slot"}
              </Button>
            </form>

            {/* List of current slots */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Current Routine & Commitments ({mySlots.length})</p>
              {loadingSlots ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading routine...</p>
              ) : mySlots.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  No routine slots found. Upload your XLSX or add custom slots above.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {mySlots.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs">
                      <div>
                        <span className="font-bold text-primary mr-1.5">[{s.day}]</span>
                        <span className="font-medium text-foreground">{s.course}</span>
                        {s.room && <span className="text-muted-foreground ml-1.5">({s.room})</span>}
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSlot(s.id)}
                        title="Delete slot"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem("userSession")
    if (!saved) return null
    try {
      return JSON.parse(saved)
    } catch {
      return null
    }
  })
  const [showAuth, setShowAuth] = useState<"login" | "register" | null>(null)
  const [page, setPage] = useState<NavPage>(() => (localStorage.getItem("activePage") as NavPage) || "dashboard")
  const [profileOpen, setProfileOpen] = useState(false)
  const [routineOpen, setRoutineOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatMember, setChatMember] = useState<Member | null>(null)
  const [pagePerms, setPagePerms] = useState<Record<string, string[]>>(DEFAULT_PAGE_PERMS)
  const [featurePerms, setFeaturePerms] = useState<Record<string, string[]>>(DEFAULT_FEATURE_PERMS)

  useEffect(() => {
    localStorage.setItem("activePage", page)
  }, [page])

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) return

    authApi.getMe().then(u => {
      // Token is still valid — refresh cached profile
      const updatedUser: AppUser = {
        id: u.id,
        name: u.name,
        email: u.email,
        initials: u.initials,
        role: normalizeRole(u.role),
        team: u.team,
        subteam: u.subteam,
        batch: u.batch,
        whatsapp: u.whatsapp,
      }
      setUser(updatedUser)
      localStorage.setItem("userSession", JSON.stringify(updatedUser))
    }).catch((err: any) => {
      // Only log out on a real 401 Unauthorized.
      // Network errors, CORS, or backend being slow should NOT log the user out.
      const msg = err?.message || ""
      const isAuthError = msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("session expired")
      if (isAuthError) {
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("userSession")
        setUser(null)
      }
      // Otherwise: keep the cached session — user stays logged in
    })
  }, [])

  const handleLogin = (u: AppUser) => {
    setUser(u)
    localStorage.setItem("userSession", JSON.stringify(u))
    setShowAuth(null)
    const savedPage = localStorage.getItem("activePage") as NavPage
    if (savedPage) {
      setPage(savedPage)
    } else {
      setPage("dashboard")
    }
  }

  const updateUser = (updatedFields: Partial<AppUser>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...updatedFields }
      localStorage.setItem("userSession", JSON.stringify(next))
      return next
    })
  }

  const handleSignOut = () => {
    authApi.logout().catch(() => { })
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("userSession")
    localStorage.removeItem("activePage")
    setUser(null);
    setPage("dashboard")
  }

  if (!user) {
    if (!showAuth) {
      return (
        <TooltipProvider>
          <LandingPage
            onGetStarted={() => setShowAuth("register")}
            onLogin={() => setShowAuth("login")}
          />
        </TooltipProvider>
      )
    }

    return (
      <TooltipProvider>
        <div className="relative">
          {/* Back button overlaying auth page */}
          <button
            onClick={() => setShowAuth(null)}
            className="absolute top-6 left-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-xs text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={14} /> Back to Home
          </button>
          <AuthPage onLogin={handleLogin} initialTab={showAuth} />
        </div>
      </TooltipProvider>
    )
  }

  const pageContent = (): React.ReactNode => {
    if (!(pagePerms[user.role] ?? []).includes(page)) return <AccessDenied requiredRole="Team Manager" />
    switch (page) {
      case "dashboard": return <DashboardPage onUploadRoutine={() => setRoutineOpen(true)} />
      case "members": return <MembersPage />
      case "search": return <SearchPage />
      case "heatmap": return <HeatmapPage />
      case "skills": return <SkillsPage />
      case "projects": return <ProjectsPage />
      case "meeting-planner": return <MeetingPlannerPage />
      case "portfolio": return <PortfolioPage />
      case "settings": return <SettingsPage onUploadRoutine={() => setRoutineOpen(true)} />
    }
  }

  return (
    <UserContext.Provider value={{ user, setUser, updateUser, pagePerms, setPagePerms, featurePerms, setFeaturePerms }}>
      <TooltipProvider>
        <div className="min-h-screen flex bg-background">
          <Sidebar page={page} setPage={setPage} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
          <div className="flex-1 ml-0 md:ml-56 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
            <TopBar page={page} onSignOut={handleSignOut} onOpenProfile={() => setProfileOpen(true)} onToggleMobileMenu={() => setMobileMenuOpen(o => !o)} />
            <main className="flex-1 p-3 sm:p-6 max-w-full overflow-x-hidden">
              {pageContent()}
            </main>
          </div>
        </div>

        <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} />
        <MemberDialog
          member={chatMember}
          open={!!chatMember}
          onOpenChange={o => !o && setChatMember(null)}
          canManage={user.role === "org-owner" || user.role === "team-manager" || user.role === "subteam-manager"}
        />
        <AIChat members={[]} user={user} onMemberClick={m => setChatMember(m)} />

        <RoutineUploadDialog open={routineOpen} onOpenChange={setRoutineOpen} />
      </TooltipProvider>
    </UserContext.Provider>
  )
}
