import { useState } from "react"
import {
  LayoutDashboard, Users, Search, BarChart3, Zap, Settings,
  ChevronRight, Bell, MessageCircle, Filter, TrendingUp,
  Shield, Calendar, LogOut, User, HelpCircle, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Minus, ArrowUpRight,
  Upload, Building2, ChevronDown, Lock, Layers, Plus, Pencil,
  Clock, AlertTriangle, Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button }           from "@/components/ui/button"
import { Badge }            from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input }            from "@/components/ui/input"
import { Separator }        from "@/components/ui/separator"
import { ScrollArea }       from "@/components/ui/scroll-area"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Progress }         from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UserContext, useUser, useUserCtx, canAccessPage, teamScope, subteamScope, roleLabel } from "@/lib/user-context"
import type { AppUser, UserRole } from "@/lib/user-context"
import { AuthPage } from "./Auth"
import { AIChat } from "@/components/AIChat"

// ─── Types ────────────────────────────────────────────────────────────────────

type AvailStatus = "free" | "in-class" | "soon" | "missing"
type NavPage     = "dashboard" | "members" | "search" | "heatmap" | "skills" | "settings"
type DayOfWeek   = "Sun" | "Mon" | "Tue" | "Wed" | "Thu"

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

const MEMBERS: Member[] = [
  {
    id:"1", name:"Aryan Hossain", initials:"AH", org:"CAIR Lab", team:"UMRT", subteams:["Software"],
    status:"free", nextChange:"Free until 3:00 PM",
    skills:["React","TypeScript","ROS"], batch:"2022", whatsapp:"880123456789", role:"Member",
    schedule:[
      { day:"Sun", startTime:"09:00", endTime:"10:30", course:"CSE 401", room:"A101" },
      { day:"Sun", startTime:"13:00", endTime:"14:30", course:"CSE 403", room:"B202" },
      { day:"Tue", startTime:"09:00", endTime:"10:30", course:"CSE 401", room:"A101" },
      { day:"Tue", startTime:"13:00", endTime:"14:30", course:"CSE 403", room:"B202" },
      { day:"Thu", startTime:"11:00", endTime:"12:30", course:"CSE 499", room:"Lab-3" },
    ],
  },
  {
    id:"2", name:"Nusrat Jahan", initials:"NJ", org:"CAIR Lab", team:"UMRT", subteams:["Electrical"],
    status:"in-class", nextChange:"Free at 12:30 PM", currentClass:"EEE 401", remainingMin:28,
    skills:["PCB Design","Embedded Systems"], batch:"2023", whatsapp:"880123456780", role:"Subteam Manager",
    schedule:[
      { day:"Mon", startTime:"11:00", endTime:"12:30", course:"EEE 401", room:"C301" },
      { day:"Mon", startTime:"15:00", endTime:"16:30", course:"EEE 403", room:"C302" },
      { day:"Wed", startTime:"11:00", endTime:"12:30", course:"EEE 401", room:"C301" },
      { day:"Wed", startTime:"15:00", endTime:"16:30", course:"EEE 403", room:"C302" },
      { day:"Thu", startTime:"09:00", endTime:"10:30", course:"EEE 499", room:"Lab-2" },
    ],
  },
  {
    id:"3", name:"Farhan Kabir", initials:"FK", org:"CAIR Lab", team:"URRT", subteams:["Mechanical"],
    status:"soon", nextChange:"Class in 18 min",
    skills:["CAD","Python"], batch:"2022", whatsapp:"880123456781", role:"Member",
    schedule:[
      { day:"Sun", startTime:"14:00", endTime:"15:30", course:"ME 401", room:"D401" },
      { day:"Tue", startTime:"14:00", endTime:"15:30", course:"ME 401", room:"D401" },
      { day:"Wed", startTime:"10:00", endTime:"11:30", course:"ME 403", room:"D402" },
      { day:"Thu", startTime:"13:00", endTime:"14:30", course:"ME 499", room:"Lab-4" },
    ],
  },
  {
    id:"4", name:"Tasneem Akter", initials:"TA", org:"CAIR Lab", team:"UMRT", subteams:["Software","Electrical"],
    status:"free", nextChange:"Free until 4:00 PM",
    skills:["Machine Learning","Python","TypeScript"], batch:"2023", whatsapp:"880123456782", role:"Member",
    schedule:[
      { day:"Mon", startTime:"09:00", endTime:"10:30", course:"CSE 411", room:"A201" },
      { day:"Mon", startTime:"16:00", endTime:"17:30", course:"CSE 413", room:"A202" },
      { day:"Wed", startTime:"09:00", endTime:"10:30", course:"CSE 411", room:"A201" },
      { day:"Thu", startTime:"11:00", endTime:"12:30", course:"CSE 499", room:"Lab-1" },
    ],
  },
  {
    id:"5", name:"Rezwan Ahmed", initials:"RA", org:"CAIR Lab", team:"URRT", subteams:["Software"],
    status:"free", nextChange:"Free until 2:00 PM",
    skills:["DevOps","React"], batch:"2021", whatsapp:"880123456783", role:"Team Manager",
    schedule:[
      { day:"Sun", startTime:"10:00", endTime:"11:30", course:"CSE 301", room:"B101" },
      { day:"Tue", startTime:"10:00", endTime:"11:30", course:"CSE 301", room:"B101" },
      { day:"Thu", startTime:"14:00", endTime:"15:30", course:"CSE 399", room:"Lab-2" },
    ],
  },
  {
    id:"6", name:"Mehzabin Islam", initials:"MI", org:"CAIR Lab", team:"Team XYZ", subteams:["UI/UX"],
    status:"in-class", nextChange:"Free at 1:00 PM", currentClass:"CSE 305", remainingMin:52,
    skills:["UI/UX","React"], batch:"2023", whatsapp:"880123456784", role:"Member",
    schedule:[
      { day:"Mon", startTime:"11:00", endTime:"13:00", course:"CSE 305", room:"A103" },
      { day:"Wed", startTime:"11:00", endTime:"13:00", course:"CSE 305", room:"A103" },
      { day:"Thu", startTime:"15:00", endTime:"16:30", course:"CSE 307", room:"A104" },
    ],
  },
  {
    id:"7", name:"Shafayat Haque", initials:"SH", org:"CAIR Lab", team:"UMRT", subteams:["Mechanical"],
    status:"free", nextChange:"Free until 5:00 PM",
    skills:["CAD","Python","Embedded Systems"], batch:"2022", whatsapp:"880123456785", role:"Member",
    schedule:[
      { day:"Sun", startTime:"08:00", endTime:"09:30", course:"ME 301", room:"D201" },
      { day:"Tue", startTime:"08:00", endTime:"09:30", course:"ME 301", room:"D201" },
      { day:"Wed", startTime:"13:00", endTime:"14:30", course:"ME 303", room:"D202" },
    ],
  },
  {
    id:"8", name:"Priyanka Das", initials:"PD", org:"CAIR Lab", team:"Team XYZ", subteams:["Software"],
    status:"missing", nextChange:"Routine not uploaded",
    skills:["Python"], batch:"2024", whatsapp:"880123456786", role:"Member",
    schedule:[],
  },
  {
    id:"9", name:"Omar Shahriar", initials:"OS", org:"CAIR Lab", team:"URRT", subteams:["Electrical"],
    status:"free", nextChange:"Free until 3:30 PM",
    skills:["PCB Design","ROS"], batch:"2022", whatsapp:"880123456787", role:"Member",
    schedule:[
      { day:"Sun", startTime:"09:00", endTime:"10:30", course:"EEE 301", room:"C101" },
      { day:"Mon", startTime:"13:00", endTime:"14:30", course:"EEE 303", room:"C102" },
      { day:"Wed", startTime:"09:00", endTime:"10:30", course:"EEE 301", room:"C101" },
      { day:"Thu", startTime:"11:00", endTime:"12:30", course:"EEE 399", room:"Lab-2" },
    ],
  },
  {
    id:"10", name:"Lamiya Chowdhury", initials:"LC", org:"CAIR Lab", team:"UMRT", subteams:["Software"],
    status:"soon", nextChange:"Class in 7 min",
    skills:["TypeScript","Machine Learning"], batch:"2023", whatsapp:"880123456788", role:"Member",
    schedule:[
      { day:"Mon", startTime:"14:00", endTime:"15:30", course:"CSE 411", room:"A201" },
      { day:"Tue", startTime:"10:00", endTime:"11:30", course:"CSE 413", room:"A202" },
      { day:"Thu", startTime:"14:00", endTime:"15:30", course:"CSE 411", room:"A201" },
    ],
  },
  {
    id:"11", name:"Sabbir Rahman", initials:"SR", org:"CAIR Lab", team:"URRT", subteams:["Mechanical"],
    status:"free", nextChange:"Free until 4:30 PM",
    skills:["CAD","Python","ROS"], batch:"2021", whatsapp:"880123456790", role:"Subteam Manager",
    schedule:[
      { day:"Sun", startTime:"11:00", endTime:"12:30", course:"ME 301", room:"D201" },
      { day:"Tue", startTime:"11:00", endTime:"12:30", course:"ME 301", room:"D201" },
      { day:"Thu", startTime:"09:00", endTime:"10:30", course:"ME 399", room:"Lab-4" },
    ],
  },
  {
    id:"12", name:"Disha Mondal", initials:"DM", org:"CAIR Lab", team:"Team XYZ", subteams:["Electrical"],
    status:"in-class", nextChange:"Free at 2:00 PM", currentClass:"PHY 201", remainingMin:41,
    skills:["Embedded Systems","PCB Design"], batch:"2024", whatsapp:"880123456791", role:"Member",
    schedule:[
      { day:"Mon", startTime:"11:00", endTime:"14:00", course:"PHY 201", room:"E101" },
      { day:"Wed", startTime:"09:00", endTime:"11:00", course:"PHY 203", room:"E102" },
      { day:"Thu", startTime:"13:00", endTime:"14:30", course:"PHY 299", room:"Lab-5" },
    ],
  },
]

// ─── Permission defaults ──────────────────────────────────────────────────────

const DEFAULT_PAGE_PERMS: Record<string, string[]> = {
  "org-owner":       ["dashboard","members","search","heatmap","skills","settings"],
  "team-manager":    ["dashboard","members","search","heatmap","skills","settings"],
  "subteam-manager": ["dashboard","members","search","heatmap","skills"],
  "member":          ["dashboard","search","skills","settings"],
}

const DEFAULT_FEATURE_PERMS: Record<string, string[]> = {
  "org-owner":       ["Manage all teams","Configure semesters","View org analytics","Assign/revoke roles","Approve skills globally"],
  "team-manager":    ["Manage team","Create & manage subteams","Assign Subteam Managers","Approve member skills","View team analytics"],
  "subteam-manager": ["Manage subteam","Add/remove members","Approve member skills","View subteam schedules","View subteam analytics"],
  "member":          ["Upload class routine","Update profile","Request new skills","View availability","Search subteam members","Contact teammates"],
}

const ALL_PAGE_OPTIONS: { id: string; label: string }[] = [
  { id:"dashboard", label:"Dashboard" },
  { id:"members",   label:"Members" },
  { id:"search",    label:"Find Members" },
  { id:"heatmap",   label:"Heatmap" },
  { id:"skills",    label:"Skills" },
  { id:"settings",  label:"Settings" },
]

const ALL_FEATURE_OPTIONS: Record<string, string[]> = {
  "team-manager":    ["Manage team","Create & manage subteams","Assign Subteam Managers","Approve member skills","View team analytics"],
  "subteam-manager": ["Manage subteam","Add/remove members","Approve member skills","View subteam schedules","View subteam analytics"],
  "member":          ["Upload class routine","Update profile","Request new skills","View availability","Search subteam members","Contact teammates"],
}

const TEAMS    = ["UMRT","URRT","Team XYZ"]
const SUBTEAMS = ["Software","Mechanical","Electrical","UI/UX"]
const BATCHES  = ["2020","2021","2022","2023","2024"]
const DAYS     = ["Sun","Mon","Tue","Wed","Thu"] as DayOfWeek[]
const HOURS    = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"]
const ALL_SKILLS = ["React","TypeScript","Python","ROS","Embedded Systems","PCB Design","CAD","Machine Learning","UI/UX","DevOps"]

const TOTALS: Record<string,number> = { "UMRT":22, "URRT":12, "Team XYZ":9 }
const HEATMAP: Record<string,Record<string,number>> = {
  "09:00":{"UMRT":20,"URRT":10,"Team XYZ":7},
  "10:00":{"UMRT":18,"URRT":9, "Team XYZ":6},
  "11:00":{"UMRT":21,"URRT":11,"Team XYZ":8},
  "12:00":{"UMRT":22,"URRT":12,"Team XYZ":9},
  "13:00":{"UMRT":19,"URRT":10,"Team XYZ":7},
  "14:00":{"UMRT":16,"URRT":8, "Team XYZ":5},
  "15:00":{"UMRT":14,"URRT":7, "Team XYZ":6},
  "16:00":{"UMRT":20,"URRT":11,"Team XYZ":8},
  "17:00":{"UMRT":22,"URRT":12,"Team XYZ":9},
}

// Subteam-level heatmap data
const SUBTEAM_TOTALS: Record<string,Record<string,number>> = {
  "UMRT":     { "Software":10, "Mechanical":6, "Electrical":6 },
  "URRT":     { "Software":5,  "Mechanical":4, "Electrical":3 },
  "Team XYZ": { "Software":4,  "UI/UX":3,      "Electrical":2 },
}
const SUBTEAM_HEATMAP: Record<string,Record<string,Record<string,number>>> = {
  "UMRT": {
    "Software":   { "09:00":9,"10:00":8,"11:00":10,"12:00":10,"13:00":9,"14:00":7,"15:00":6,"16:00":9,"17:00":10 },
    "Mechanical": { "09:00":5,"10:00":4,"11:00":6, "12:00":6, "13:00":5,"14:00":4,"15:00":4,"16:00":5,"17:00":6 },
    "Electrical": { "09:00":4,"10:00":4,"11:00":5, "12:00":6, "13:00":5,"14:00":4,"15:00":3,"16:00":5,"17:00":6 },
  },
  "URRT": {
    "Software":   { "09:00":4,"10:00":3,"11:00":5,"12:00":5,"13:00":4,"14:00":3,"15:00":3,"16:00":4,"17:00":5 },
    "Mechanical": { "09:00":3,"10:00":3,"11:00":4,"12:00":4,"13:00":3,"14:00":3,"15:00":2,"16:00":3,"17:00":4 },
    "Electrical": { "09:00":2,"10:00":2,"11:00":3,"12:00":3,"13:00":2,"14:00":2,"15:00":2,"16:00":3,"17:00":3 },
  },
  "Team XYZ": {
    "Software": { "09:00":3,"10:00":2,"11:00":4,"12:00":4,"13:00":3,"14:00":2,"15:00":2,"16:00":3,"17:00":4 },
    "UI/UX":    { "09:00":2,"10:00":2,"11:00":3,"12:00":3,"13:00":2,"14:00":2,"15:00":2,"16:00":3,"17:00":3 },
    "Electrical":{ "09:00":1,"10:00":1,"11:00":2,"12:00":2,"13:00":2,"14:00":1,"15:00":1,"16:00":2,"17:00":2 },
  },
}

const PENDING_APPROVALS = [
  { id:"a1", member:"Aryan Hossain",    initials:"AH", skill:"Machine Learning", team:"UMRT",     subteam:"Software",   requested:"3 days ago" },
  { id:"a2", member:"Omar Shahriar",    initials:"OS", skill:"ROS",              team:"URRT",     subteam:"Electrical", requested:"1 day ago" },
  { id:"a3", member:"Lamiya Chowdhury", initials:"LC", skill:"DevOps",           team:"UMRT",     subteam:"Software",   requested:"5 hours ago" },
]

const CHART_SLOTS = [
  { t:"09:00", v:40 }, { t:"10:00", v:33 }, { t:"11:00", v:40 },
  { t:"12:00", v:43 }, { t:"13:00", v:36 }, { t:"14:00", v:29 },
  { t:"15:00", v:27 }, { t:"16:00", v:38 }, { t:"17:00", v:43 },
]

// ─── Availability helper ───────────────────────────────────────────────────────

function isFreeAt(member: Member, day: DayOfWeek, time: string): boolean {
  if (member.status === "missing") return false
  const [h, m] = time.split(":").map(Number)
  const tMin = h * 60 + m
  return !member.schedule.some(slot => {
    if (slot.day !== day) return false
    const [sh, sm] = slot.startTime.split(":").map(Number)
    const [eh, em] = slot.endTime.split(":").map(Number)
    return tMin >= sh * 60 + sm && tMin < eh * 60 + em
  })
}

// ─── Status helpers ────────────────────────────────────────────────────────────

type BadgeVariant = "success" | "destructive" | "warning" | "muted"

function statusMeta(s: AvailStatus): { dotClass: string; label: string; variant: BadgeVariant; icon: React.ReactNode } {
  const map = {
    free:       { dotClass:"bg-success",          label:"Free",       variant:"success"     as BadgeVariant, icon:<CheckCircle2 size={11}/> },
    "in-class": { dotClass:"bg-destructive",      label:"In Class",   variant:"destructive" as BadgeVariant, icon:<XCircle size={11}/> },
    soon:       { dotClass:"bg-warning",          label:"Class Soon", variant:"warning"     as BadgeVariant, icon:<AlertCircle size={11}/> },
    missing:    { dotClass:"bg-muted-foreground", label:"No Routine", variant:"muted"       as BadgeVariant, icon:<Minus size={11}/> },
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
  const dot = size === "sm" ? "w-2 h-2"  : "w-2.5 h-2.5"
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
  if (ratio >= 0.5)  return "warning"
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

// ─── Nav ──────────────────────────────────────────────────────────────────────

const ALL_NAV: { id: NavPage; label: string; icon: React.ReactNode }[] = [
  { id:"dashboard", label:"Dashboard",    icon:<LayoutDashboard size={15}/> },
  { id:"members",   label:"Members",      icon:<Users size={15}/> },
  { id:"search",    label:"Find Members", icon:<Search size={15}/> },
  { id:"heatmap",   label:"Heatmap",      icon:<BarChart3 size={15}/> },
  { id:"skills",    label:"Skills",       icon:<Zap size={15}/> },
  { id:"settings",  label:"Settings",     icon:<Settings size={15}/> },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage }: { page: NavPage; setPage: (p: NavPage) => void }) {
  const { user, pagePerms } = useUserCtx()
  const nav  = ALL_NAV.filter(n => (pagePerms[user.role] ?? []).includes(n.id))

  return (
    <aside className="fixed inset-y-0 left-0 w-56 flex flex-col bg-sidebar border-r border-sidebar-border">
      <div className="h-14 flex items-center gap-3 px-4 border-b border-sidebar-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Building2 size={13} className="text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground leading-none">RoverBuddies</p>
          <p className="text-[10px] font-mono text-sidebar-muted-foreground mt-0.5">CAIR Lab</p>
        </div>
      </div>

      <ScrollArea className="flex-1 py-3">
        <nav className="px-3 space-y-0.5">
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
            Navigation
          </p>
          {nav.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
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
              ? <div className="flex items-center gap-1.5"><Shield size={10}/>All teams</div>
              : <div className="flex items-center gap-1.5"><Shield size={10}/>{user.team}</div>
            }
            {(user.role === "subteam-manager" || user.role === "member") && (
              <div className="flex items-center gap-1.5"><Layers size={10}/>{user.subteam}</div>
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
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ page, onSignOut, onOpenProfile }: {
  page: NavPage; onSignOut: () => void; onOpenProfile: () => void
}) {
  const user  = useUser()
  const label = ALL_NAV.find(n => n.id === page)?.label

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center gap-2 px-6 border-b bg-card/80 backdrop-blur-md">
      <span className="text-xs text-muted-foreground">CAIR Lab</span>
      <ChevronRight size={12} className="text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{label}</span>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="success" className="gap-1.5 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
          Live
        </Badge>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8"><Bell size={15} /></Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-8 px-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{user.initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user.name}</span>
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

function ProfileEditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useUser()
  const [name,     setName]     = useState(user.name)
  const [whatsapp, setWhatsapp] = useState(user.whatsapp)
  const [saved,    setSaved]    = useState(false)

  const handleSave = () => { setSaved(true); setTimeout(() => { setSaved(false); onOpenChange(false) }, 900) }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>Update your personal information</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="text-lg bg-primary text-primary-foreground font-semibold">{user.initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <Badge variant="outline" className="text-[10px] mt-1">{roleLabel(user.role)}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label:"Organization", value:user.team === "UMRT" || user.team === "URRT" ? "CAIR Lab" : "CAIR Lab" },
              { label:"Team",         value:user.team },
              { label:"Subteam",      value:user.subteam },
              { label:"Batch",        value:user.batch },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-lg bg-muted">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{f.label}</p>
                <p className="text-sm font-medium text-foreground">{f.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Display Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">WhatsApp Number</label>
              <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="880..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="gap-1.5" disabled={saved}>
            {saved ? <><CheckCircle2 size={14}/> Saved</> : <><Save size={14}/> Save Changes</>}
          </Button>
        </DialogFooter>
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
    success:     { text:"text-success",         indicator:"bg-success" },
    destructive: { text:"text-destructive",      indicator:"bg-destructive" },
    warning:     { text:"text-warning",          indicator:"bg-warning" },
    muted:       { text:"text-muted-foreground", indicator:"bg-muted-foreground" },
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
        <Progress value={(value / Math.max(MEMBERS.length,1)) * 100} className="h-1 mt-3 bg-secondary" indicatorClassName={indicator} />
      </CardContent>
    </Card>
  )
}

function DashboardPage({ onUploadRoutine }: { onUploadRoutine: () => void }) {
  const user    = useUser()
  const tScope  = teamScope(user)
  const stScope = subteamScope(user)

  const pool = MEMBERS.filter(m => {
    if (tScope  && m.team        !== tScope)  return false
    if (stScope && !m.subteams.includes(stScope)) return false
    return true
  })

  const [tab, setTab] = useState<AvailStatus | "all">("all")
  const free    = pool.filter(m => m.status === "free").length
  const inClass = pool.filter(m => m.status === "in-class").length
  const soon    = pool.filter(m => m.status === "soon").length
  const missing = pool.filter(m => m.status === "missing").length
  const shown   = tab === "all" ? pool : pool.filter(m => m.status === tab)

  const subteams = [...new Set(pool.flatMap(m => m.subteams))]

  // For "becoming free next" — in-class members sorted by least remaining time
  const becomingFree = pool.filter(m => m.status === "in-class" && m.remainingMin !== undefined)
    .sort((a,b) => (a.remainingMin ?? 99) - (b.remainingMin ?? 99))

  const isMemberMissing = user.role === "member" && pool.find(m => m.name === user.name)?.status === "missing"

  return (
    <div className="space-y-5">
      {isMemberMissing && <RoutineRestrictionBanner onUpload={onUploadRoutine} />}

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Good afternoon, {user.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tScope ?? "CAIR Lab"}{stScope ? ` · ${stScope}` : ""} · Mon, Aug 4, 2026 · 2:00 PM
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><RefreshCw size={13}/> Refresh</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Free Now"   value={free}    sub={`${Math.round((free/Math.max(pool.length,1))*100)}% of scope`} icon={<CheckCircle2 size={16}/>} variant="success" />
        <StatCard label="In Class"   value={inClass} sub="Currently unavailable"                                          icon={<XCircle size={16}/>}      variant="destructive" />
        <StatCard label="Class Soon" value={soon}    sub="Free within 30 min"                                             icon={<AlertCircle size={16}/>}  variant="warning" />
        <StatCard label="No Routine" value={missing} sub="Action required"                                                icon={<Shield size={16}/>}       variant="muted" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Live table */}
        <Card className="col-span-2">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Live Availability</CardTitle>
                <CardDescription className="text-xs mt-0.5">{pool.length} members · updated just now</CardDescription>
              </div>
              <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all"      className="text-xs px-2.5">All</TabsTrigger>
                  <TabsTrigger value="free"     className="text-xs px-2.5">Free</TabsTrigger>
                  <TabsTrigger value="in-class" className="text-xs px-2.5">Busy</TabsTrigger>
                  <TabsTrigger value="soon"     className="text-xs px-2.5">Soon</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-0">
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Member</TableHead>
                    <TableHead>Subteam</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="font-mono text-[11px]">Next Change</TableHead>
                    <TableHead className="font-mono text-[11px]">Remaining</TableHead>
                    <TableHead className="w-10"/>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="pl-3">
                        <div className="flex items-center gap-2.5">
                          <MemberAvatar member={m} size="sm"/>
                          <span className="text-sm font-medium">{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.subteams[0]}</TableCell>
                      <TableCell><StatusBadge status={m.status}/></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{m.nextChange}</TableCell>
                      <TableCell>
                        {m.status === "in-class" && m.remainingMin !== undefined
                          ? <span className="text-xs font-mono text-destructive flex items-center gap-1"><Clock size={10}/>{m.remainingMin}m left</span>
                          : <span className="text-xs text-muted-foreground/40">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                              <a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noreferrer">
                                <MessageCircle size={13}/>
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>WhatsApp {m.name}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Becoming free next */}
          {becomingFree.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock size={13} className="text-warning"/> Becoming Free Next
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {becomingFree.slice(0,3).map(m => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <MemberAvatar member={m} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.nextChange}</p>
                    </div>
                    <span className="text-[10px] font-mono text-warning shrink-0">{m.remainingMin}m</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Today&#39;s Availability</CardTitle>
              <CardDescription className="text-xs">Members free per hour</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-end gap-1 h-20">
                {CHART_SLOTS.map(s => {
                  const pct   = s.v / 43
                  const isNow = s.t === "14:00"
                  const barClass = isNow ? "bg-primary"
                    : pct > 0.8 ? "bg-success/60" : pct > 0.6 ? "bg-warning/60" : "bg-destructive/60"
                  return (
                    <Tooltip key={s.t}>
                      <TooltipTrigger asChild>
                        <div className="flex-1 flex flex-col items-center gap-1 cursor-default">
                          <div className={cn("w-full rounded-t-sm transition-all", barClass, !isNow && "opacity-70 hover:opacity-100")}
                            style={{ height:`${pct*76}px` }}/>
                          <span className={cn("text-[9px] font-mono", isNow ? "text-primary font-bold" : "text-muted-foreground")}>
                            {s.t.slice(0,2)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{s.v}/43 free at {s.t}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
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
                const total   = pool.filter(m => m.subteams.includes(sub)).length
                const freeNow = pool.filter(m => m.subteams.includes(sub) && m.status === "free").length
                if (!total) return null
                const pct = Math.round((freeNow/total)*100)
                return (
                  <div key={sub}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground">{sub}</span>
                      <span className="text-muted-foreground font-mono">{freeNow}/{total} · {pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5 bg-secondary" indicatorClassName="bg-success"/>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Member Profile Dialog ────────────────────────────────────────────────────

function MemberDialog({ member, open, onOpenChange, canManage }: {
  member: Member | null; open: boolean; onOpenChange: (o: boolean) => void; canManage: boolean
}) {
  if (!member) return null
  const todaySlots = member.schedule.filter(s => s.day === "Mon") // Mon = today in demo

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <MemberAvatar member={member} size="lg"/>
            <div>
              <p>{member.name}</p>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                {member.role} · {member.org} · {member.team}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Key info grid */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { label:"Status",   node:<StatusBadge status={member.status}/> },
              { label:"Batch",    node:<span className="text-sm font-mono text-foreground">{member.batch}</span> },
              { label:"Next",     node:<span className="text-sm font-mono text-foreground">{member.nextChange}</span> },
              { label:"Org",      node:<span className="text-sm text-foreground">{member.org}</span> },
              { label:"Team",     node:<span className="text-sm text-foreground">{member.team}</span> },
              { label:"Subteam(s)", node:
                <div className="flex flex-wrap gap-1">
                  {member.subteams.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
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
          {member.status === "in-class" && member.remainingMin !== undefined && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <Clock size={14} className="text-destructive shrink-0"/>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">In {member.currentClass}</p>
                <Progress value={((90-member.remainingMin)/90)*100} className="h-1 mt-1.5 bg-destructive/20" indicatorClassName="bg-destructive"/>
              </div>
              <span className="text-xs font-mono text-destructive">{member.remainingMin}m left</span>
            </div>
          )}

          {/* Today's schedule */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today&#39;s Schedule (Mon)</p>
            {todaySlots.length === 0
              ? <p className="text-xs text-muted-foreground">No classes today</p>
              : (
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Weekly Schedule</p>
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {DAYS.map(day => {
                const slots = member.schedule.filter(s => s.day === day)
                return (
                  <div key={day} className="rounded-lg bg-muted p-2 min-h-16">
                    <p className="font-semibold text-muted-foreground mb-1.5">{day}</p>
                    {slots.length === 0
                      ? <p className="text-muted-foreground/40 italic">Free</p>
                      : slots.map((s,i) => (
                        <div key={i} className="mb-1 last:mb-0">
                          <p className="font-medium text-foreground leading-tight">{s.course}</p>
                          <p className="text-muted-foreground">{s.startTime}</p>
                        </div>
                      ))
                    }
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
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"><Pencil size={12}/> Edit Role</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive">
                <XCircle size={12}/> Remove
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="gap-1.5" asChild>
            <a href={`https://wa.me/${member.whatsapp}`} target="_blank" rel="noreferrer">
              <MessageCircle size={14}/> WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Members Page ─────────────────────────────────────────────────────────────

function MembersPage() {
  const user      = useUser()
  const tScope    = teamScope(user)
  const stScope   = subteamScope(user)
  const canManage = user.role !== "member"

  const [teamFilter, setTeamFilter] = useState(tScope ?? "all")
  const [selected,   setSelected]   = useState<Member | null>(null)

  const filtered = MEMBERS.filter(m => {
    if (stScope && !m.subteams.includes(stScope))      return false
    if (tScope  && m.team !== tScope)                  return false
    if (!tScope && teamFilter !== "all" && m.team !== teamFilter) return false
    return true
  })

  const byTeam: Record<string, Member[]> = {}
  filtered.forEach(m => { (byTeam[m.team] = byTeam[m.team] ?? []).push(m) })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Members</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {filtered.length} members{stScope ? ` in ${stScope}` : tScope ? ` in ${tScope}` : ` across ${TEAMS.length} teams`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "org-owner" && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Teams"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {(user.role === "org-owner" || user.role === "team-manager") && (
            <Button size="sm" className="gap-1.5"><Plus size={13}/>Add Member</Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5"><ArrowUpRight size={13}/>Export</Button>
        </div>
      </div>

      {Object.entries(byTeam).map(([team, members]) => (
        <div key={team}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">{team}</h2>
            <Badge variant="secondary" className="font-mono">{members.length}</Badge>
            <Separator className="flex-1"/>
            <span className="text-xs text-muted-foreground">{members.filter(m=>m.status==="free").length} free now</span>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Subteam(s)</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="w-10"/>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(m => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <MemberAvatar member={m}/>
                        <span className="text-sm font-medium text-foreground">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{m.role}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {m.subteams.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{m.batch}</TableCell>
                    <TableCell><StatusBadge status={m.status}/></TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {m.skills.slice(0,2).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                        {m.skills.length>2 && <Badge variant="outline" className="text-[10px]">+{m.skills.length-2}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                        <a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noreferrer">
                          <MessageCircle size={13}/>
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      ))}

      <MemberDialog member={selected} open={!!selected} onOpenChange={o => !o && setSelected(null)} canManage={canManage}/>
    </div>
  )
}

// ─── Search Page ──────────────────────────────────────────────────────────────

function SearchPage() {
  const user    = useUser()
  const tScope  = teamScope(user)
  const stScope = subteamScope(user)

  const [query,   setQuery]   = useState("")
  const [team,    setTeam]    = useState(tScope ?? "all")
  const [sub,     setSub]     = useState(stScope ?? "all")
  const [status,  setStatus]  = useState("all")
  const [skill,   setSkill]   = useState("all")
  const [day,     setDay]     = useState("all")
  const [time,    setTime]    = useState("all")
  const [batch,   setBatch]   = useState("all")
  const [selected, setSelected] = useState<Member | null>(null)

  const results = MEMBERS.filter(m => {
    if (tScope  && m.team !== tScope)                  return false
    if (stScope && !m.subteams.includes(stScope))      return false
    if (!tScope  && team  !== "all" && m.team !== team) return false
    if (!stScope && sub   !== "all" && !m.subteams.includes(sub)) return false
    if (status !== "all" && m.status !== status)        return false
    if (skill  !== "all" && !m.skills.includes(skill))  return false
    if (batch  !== "all" && m.batch !== batch)           return false
    if (day    !== "all" && time !== "all") {
      if (!isFreeAt(m, day as DayOfWeek, time)) return false
    }
    if (query && !m.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const dayTimeActive = day !== "all" && time !== "all"
  const dirty = !!(query || (!tScope && team !== "all") || (!stScope && sub !== "all")
    || status !== "all" || skill !== "all" || batch !== "all" || dayTimeActive)

  function reset() {
    setQuery(""); setTeam(tScope ?? "all"); setSub(stScope ?? "all")
    setStatus("all"); setSkill("all"); setDay("all"); setTime("all"); setBatch("all")
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Find Members</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {stScope ? `Search within ${stScope} subteam`
            : tScope ? `Search within ${tScope} team`
            : "Search by name, team, subteam, day/time, skill, or availability"
          }
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Row 1 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-44">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)} className="pl-8"/>
            </div>
            {!tScope && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Team"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!stScope && (
              <Select value={sub} onValueChange={setSub}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Subteam"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subteams</SelectItem>
                  {SUBTEAMS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Availability"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="free">Free Now</SelectItem>
                <SelectItem value="in-class">In Class</SelectItem>
                <SelectItem value="soon">Class Soon</SelectItem>
                <SelectItem value="missing">No Routine</SelectItem>
              </SelectContent>
            </Select>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Skill"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Skill</SelectItem>
                {ALL_SKILLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Batch"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Batch</SelectItem>
                {BATCHES.map(b => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Row 2 — Day + Time (key feature from spec) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-muted-foreground"/>
              <span className="text-xs text-muted-foreground font-medium">Availability at:</span>
            </div>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Day"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Day</SelectItem>
                {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Time"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Time</SelectItem>
                {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
            {dayTimeActive && (
              <Badge variant="success" className="text-[11px] gap-1">
                <CheckCircle2 size={10}/>
                Free on {day} at {time}
              </Badge>
            )}
            {(tScope || stScope) && (
              <div className="ml-auto flex items-center gap-1.5">
                <Lock size={10} className="text-muted-foreground"/>
                <span className="text-xs text-muted-foreground">Scoped to {stScope ?? tScope}</span>
              </div>
            )}
            {dirty && (
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground ml-auto">
                <Filter size={13}/> Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        {dirty && <Badge variant="secondary">filtered</Badge>}
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search size={32} className="mx-auto mb-3 text-muted-foreground/30"/>
            <p className="text-sm font-medium text-foreground">No members match your filters</p>
            <p className="text-xs text-muted-foreground mt-1">Try broadening the search criteria</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={reset}>Reset filters</Button>
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
                <TableHead className="w-28"/>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map(m => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar member={m}/>
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        {dayTimeActive && (
                          <p className="text-[10px] text-success flex items-center gap-1">
                            <CheckCircle2 size={9}/> Free {day} {time}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.team} / {m.subteams.join(", ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.batch}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {m.skills.map(s => (
                        <Badge key={s} variant={skill===s ? "default" : "secondary"} className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={m.status}/></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.nextChange}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" asChild>
                      <a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noreferrer">
                        <MessageCircle size={12}/> Chat
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <MemberDialog member={selected} open={!!selected} onOpenChange={o => !o && setSelected(null)} canManage={false}/>
    </div>
  )
}

// ─── Heatmap Page ─────────────────────────────────────────────────────────────

function HeatmapPage() {
  const user   = useUser()
  const tScope = teamScope(user)

  const [day,        setDay]        = useState("monday")
  const [batchFilter,setBatchFilter] = useState("all")
  const [fromHour,   setFromHour]   = useState("09:00")
  const [toHour,     setToHour]     = useState("17:00")
  const [subteamTeam,setSubteamTeam] = useState(tScope ?? TEAMS[0])

  const defaultTab = tScope ? "team" : "org"

  const filteredHours = HOURS.filter(h => h >= fromHour && h <= toHour)
  const visibleTeams  = tScope ? [tScope] : TEAMS

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Availability Heatmap</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Identify peak collaboration windows across the week</p>
        </div>
        {/* Global filters */}
        <div className="flex items-center gap-2">
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="w-36"><SelectValue/></SelectTrigger>
            <SelectContent>
              {["monday","tuesday","wednesday","thursday","friday"].map(d => (
                <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Batch"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {BATCHES.map(b => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Time range filter */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-xs text-muted-foreground font-medium">Time range:</span>
        <Select value={fromHour} onValueChange={setFromHour}>
          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue/></SelectTrigger>
          <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-muted-foreground text-xs">to</span>
        <Select value={toHour} onValueChange={setToHour}>
          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue/></SelectTrigger>
          <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {!tScope && <TabsTrigger value="org">Organization</TabsTrigger>}
          <TabsTrigger value="team">By Team</TabsTrigger>
          <TabsTrigger value="subteam">By Subteam</TabsTrigger>
        </TabsList>

        {/* ── Organization view ── */}
        {!tScope && (
          <TabsContent value="org" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5 w-24">Time</TableHead>
                      {TEAMS.map(t => (
                        <TableHead key={t} className="text-center">
                          <div className="text-foreground">{t}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">{TOTALS[t]} members</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Window</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHours.map(h => {
                      const ratios = TEAMS.map(t => HEATMAP[h][t] / TOTALS[t])
                      const best   = Math.max(...ratios)
                      return (
                        <TableRow key={h}>
                          <TableCell className="pl-5 font-mono text-xs text-muted-foreground">{h}</TableCell>
                          {TEAMS.map((t,i) => {
                            const free  = HEATMAP[h][t]
                            const total = TOTALS[t]
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
                                <TooltipContent>{Math.round(ratio*100)}% of {t} free at {h}</TooltipContent>
                              </Tooltip>
                            )
                          })}
                          <TableCell className="text-center">
                            {best >= 0.85
                              ? <Badge variant="success"><TrendingUp size={10}/> Good slot</Badge>
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
          </TabsContent>
        )}

        {/* ── By Team view ── */}
        <TabsContent value="team" className="mt-4">
          <div className={`grid gap-4 ${visibleTeams.length === 1 ? "grid-cols-1 max-w-lg" : "grid-cols-3"}`}>
            {visibleTeams.map(team => (
              <Card key={team}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{team}</CardTitle>
                  <CardDescription className="text-xs">{TOTALS[team]} members total</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2.5">
                  {filteredHours.map(h => {
                    const free  = HEATMAP[h][team]
                    const total = TOTALS[team]
                    const ratio = free / total
                    const ind   = ratio >= 0.7 ? "bg-success" : ratio >= 0.5 ? "bg-warning" : "bg-destructive"
                    return (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-10 shrink-0">{h}</span>
                        <Progress value={ratio*100} className="flex-1 h-1.5 bg-secondary" indicatorClassName={ind}/>
                        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{free}/{total}</span>
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
          {/* Team selector for subteam drill-down */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Team:</span>
            <div className="flex gap-1.5">
              {visibleTeams.map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant={subteamTeam === t ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setSubteamTeam(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          {/* Subteam table */}
          {SUBTEAM_TOTALS[subteamTeam] && (
            <>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-5 w-24">Time</TableHead>
                        {Object.keys(SUBTEAM_TOTALS[subteamTeam]).map(sub => (
                          <TableHead key={sub} className="text-center">
                            <div className="text-foreground">{sub}</div>
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {SUBTEAM_TOTALS[subteamTeam][sub]} members
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Window</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHours.map(h => {
                        const subNames = Object.keys(SUBTEAM_TOTALS[subteamTeam])
                        const ratios   = subNames.map(s =>
                          (SUBTEAM_HEATMAP[subteamTeam]?.[s]?.[h] ?? 0) / SUBTEAM_TOTALS[subteamTeam][s]
                        )
                        const best = Math.max(...ratios)
                        return (
                          <TableRow key={h}>
                            <TableCell className="pl-5 font-mono text-xs text-muted-foreground">{h}</TableCell>
                            {subNames.map((sub,i) => {
                              const free  = SUBTEAM_HEATMAP[subteamTeam]?.[sub]?.[h] ?? 0
                              const total = SUBTEAM_TOTALS[subteamTeam][sub]
                              const ratio = ratios[i]
                              return (
                                <Tooltip key={sub}>
                                  <TooltipTrigger asChild>
                                    <TableCell className="text-center">
                                      <Badge variant={heatBadgeVariant(ratio)} className="font-mono cursor-default">
                                        {free}/{total}
                                      </Badge>
                                    </TableCell>
                                  </TooltipTrigger>
                                  <TooltipContent>{Math.round(ratio*100)}% of {sub} free at {h}</TooltipContent>
                                </Tooltip>
                              )
                            })}
                            <TableCell className="text-center">
                              {best >= 0.85
                                ? <Badge variant="success"><TrendingUp size={10}/> Good slot</Badge>
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Skills Page ──────────────────────────────────────────────────────────────

const MY_SKILLS         = ["React","TypeScript","ROS"]
const MY_PENDING_SKILLS = ["Machine Learning"]

function SkillsPage() {
  const user    = useUser()
  const tScope  = teamScope(user)
  const stScope = subteamScope(user)
  const isMember = user.role === "member"

  const filteredPending = PENDING_APPROVALS.filter(r => {
    if (tScope  && r.team    !== tScope)  return false
    if (stScope && r.subteam !== stScope) return false
    return true
  })

  const [pending,    setPending]   = useState(filteredPending)
  const [mySkills,   setMySkills]  = useState(MY_SKILLS)
  const [myPending,  setMyPending] = useState(MY_PENDING_SKILLS)
  const [requesting, setRequesting] = useState(false)
  const [requested,  setRequested] = useState("")

  function approve(id: string) { setPending(p => p.filter(x => x.id !== id)) }
  function reject(id: string)  { setPending(p => p.filter(x => x.id !== id)) }

  function handleRequestSkill() {
    if (!requested || mySkills.includes(requested) || myPending.includes(requested)) return
    setMyPending(p => [...p, requested])
    setRequested("")
    setRequesting(false)
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
          <Button size="sm" className="gap-1.5" onClick={() => setRequesting(true)}>
            <Plus size={13}/> Request Skill
          </Button>
        )}
      </div>

      {/* Member view */}
      {isMember && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My Approved Skills</CardTitle>
              <CardDescription className="text-xs">Skills verified by your manager — appear in search results</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {mySkills.map(s => (
                  <Badge key={s} variant="success" className="gap-1.5 text-xs py-1 px-2.5">
                    <CheckCircle2 size={11}/> {s}
                  </Badge>
                ))}
              </div>
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
                        <AlertCircle size={11}/> {s}
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
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
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
                    <CheckCircle2 size={32} className="mx-auto mb-3 text-success opacity-60"/>
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
                                <CheckCircle2 size={12}/> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => reject(r.id)}>
                                <XCircle size={12}/> Reject
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
              <CardTitle className="text-sm">Skill Catalog</CardTitle>
              <CardDescription className="text-xs">Approved members per skill (searchable)</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              {ALL_SKILLS.map(s => {
                const count = MEMBERS.filter(m =>
                  m.skills.includes(s) &&
                  (!tScope  || m.team === tScope) &&
                  (!stScope || m.subteams.includes(stScope))
                ).length
                const total = MEMBERS.filter(m =>
                  (!tScope  || m.team === tScope) &&
                  (!stScope || m.subteams.includes(stScope))
                ).length
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="text-sm text-foreground flex-1">{s}</span>
                    <Progress value={(count/Math.max(total,1))*100} className="w-16 h-1.5 bg-secondary"/>
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request a New Skill</DialogTitle>
            <DialogDescription>Your Subteam Manager will review and approve. Only approved skills appear in search results.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={requested} onValueChange={setRequested}>
              <SelectTrigger><SelectValue placeholder="Select skill to request"/></SelectTrigger>
              <SelectContent>
                {ALL_SKILLS.filter(s => !mySkills.includes(s) && !myPending.includes(s)).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequesting(false)}>Cancel</Button>
            <Button onClick={handleRequestSkill} disabled={!requested}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Teams Tab ────────────────────────────────────────────────────────────────

function TeamsTab({ user }: { user: AppUser }) {
  const [managingTeam, setManagingTeam] = useState<string | null>(null)
  const [newName,      setNewName]      = useState("")
  const [addSubteam,   setAddSubteam]   = useState("")
  const [saved,        setSaved]        = useState(false)

  const isOwner   = user.role === "org-owner"
  const items     = isOwner ? TEAMS : SUBTEAMS
  const managedPool = managingTeam
    ? MEMBERS.filter(m => isOwner ? m.team === managingTeam : m.team === user.team && m.subteams.includes(managingTeam))
    : []
  const subteamsOfTeam = managingTeam && isOwner
    ? [...new Set(MEMBERS.filter(m => m.team === managingTeam).flatMap(m => m.subteams))]
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
                <Plus size={13}/>{user.role === "team-manager" ? "Add Subteam" : "Add Team"}
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
                  <TableHead className="w-20"/>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(name => {
                  const pool    = MEMBERS.filter(m => isOwner ? m.team === name : m.team === user.team && m.subteams.includes(name))
                  const freeNow = pool.filter(m => m.status === "free").length
                  const missing = pool.filter(m => m.status === "missing").length
                  return (
                    <TableRow key={name}>
                      <TableCell className="font-medium text-sm text-foreground">{name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{pool.length}</TableCell>
                      <TableCell><Badge variant={freeNow>0?"success":"muted"} className="font-mono">{freeNow}</Badge></TableCell>
                      <TableCell>
                        {missing > 0
                          ? <Badge variant="warning" className="font-mono gap-1"><AlertTriangle size={10}/>{missing}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(name)}>
                          <Pencil size={11}/>Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
                <Building2 size={15} className="text-primary"/>
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
                <Input value={newName} onChange={e => { setNewName(e.target.value); setSaved(false) }} className="flex-1"/>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setSaved(true)} disabled={newName === managingTeam || !newName}>
                  {saved ? <><CheckCircle2 size={13}/> Saved</> : <><Save size={13}/> Rename</>}
                </Button>
              </div>
            </div>

            {/* Subteams list (org-owner only) */}
            {isOwner && subteamsOfTeam.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Subteams</p>
                <div className="flex flex-wrap gap-1.5">
                  {subteamsOfTeam.map(s => (
                    <div key={s} className="flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5">
                      <span className="text-xs text-foreground">{s}</span>
                      <button className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
                        <XCircle size={12}/>
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
                      <Plus size={11}/>Add
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
                  {managedPool.filter(m=>m.status==="free").length} free now
                </Badge>
              </div>
              <ScrollArea className="h-52 rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {managedPool.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-8">No members in this {isOwner?"team":"subteam"}</p>
                    : managedPool.map(m => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                        <MemberAvatar member={m} size="sm"/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.batch} · {m.subteams.join(", ")}</p>
                        </div>
                        <StatusBadge status={m.status}/>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0">
                              <ChevronDown size={12}/>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-[11px]">Member Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem className="text-xs gap-2"><Pencil size={12}/>Change Role</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs gap-2"><ArrowUpRight size={12}/>Move to Team</DropdownMenuItem>
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive">
                              <XCircle size={12}/>Remove from {isOwner ? "team" : "subteam"}
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
              <XCircle size={13}/> Delete {isOwner ? "Team" : "Subteam"}
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
  const defaultTab = user.role === "member" ? "routine" : "semester"

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {user.role === "member" ? "Upload and manage your class schedule" : "Manage semester configuration and access control"}
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {user.role === "org-owner" && <TabsTrigger value="semester">Semester</TabsTrigger>}
          {user.role === "org-owner" && <TabsTrigger value="access">Access Control</TabsTrigger>}
          {(user.role === "org-owner" || user.role === "team-manager") && <TabsTrigger value="teams">Teams</TabsTrigger>}
          <TabsTrigger value="routine">{user.role === "member" ? "My Schedule" : "Routine Upload"}</TabsTrigger>
        </TabsList>

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
                    { label:"Semester Name",   value:"Fall 2026" },
                    { label:"Start Date",      value:"September 1, 2026" },
                    { label:"End Date",        value:"December 31, 2026" },
                    { label:"Upload Deadline", value:"September 10, 2026" },
                  ].map(f => (
                    <div key={f.label} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                      <Input defaultValue={f.value}/>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-warning"/>
                    Post-deadline enforcement
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Members who have not uploaded a valid routine after the deadline will be restricted from the platform until they upload their current semester schedule.
                  </p>
                </div>
                <Separator/>
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
                  <Badge variant="secondary" className="text-[10px] gap-1"><Shield size={10}/>Live</Badge>
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
                    {(["team-manager","subteam-manager","member"] as UserRole[]).map(role => {
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
                                    {on ? <CheckCircle2 size={9}/> : <XCircle size={9}/>}
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
                  <Lock size={9}/> Organization Owner always has full access and cannot be restricted.
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
                      { roleKey:"org-owner"       as UserRole, scope:"Entire org",       locked:true },
                      { roleKey:"team-manager"    as UserRole, scope:"Assigned team",    locked:false },
                      { roleKey:"subteam-manager" as UserRole, scope:"Assigned subteam", locked:false },
                      { roleKey:"member"          as UserRole, scope:"Own subteam(s)",   locked:false },
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
                                    <CheckCircle2 size={9} className="text-success"/>{p}
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
                                    {on ? <CheckCircle2 size={9} className="text-success"/> : <XCircle size={9} className="text-destructive/50"/>}
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
          <TeamsTab user={user}/>
        )}

        {/* Routine Upload — all roles */}
        <TabsContent value="routine" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {user.role === "member" ? "My Class Schedule" : "Routine Upload"}
              </CardTitle>
              <CardDescription>
                {user.role === "member"
                  ? "Upload your UCAM XLSX schedule. Members without a valid routine are restricted after the deadline."
                  : "Members must upload their class schedule each semester before the deadline."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user.role === "member" && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle2 size={16} className="text-success shrink-0"/>
                  <div>
                    <p className="text-xs font-medium text-foreground">Routine synced · Fall 2026</p>
                    <p className="text-xs text-muted-foreground">18 classes · 4 labs · uploaded Aug 4, 2026</p>
                  </div>
                  <Button variant="outline" size="sm" className="ml-auto text-xs h-7" onClick={onUploadRoutine}>Update</Button>
                </div>
              )}
              <div
                className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={onUploadRoutine}
              >
                <Upload size={28} className="mx-auto mb-3 text-muted-foreground"/>
                <p className="text-sm font-medium text-foreground">Upload UCAM XLSX</p>
                <p className="text-xs text-muted-foreground mt-1">Drag and drop or click to browse</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={e => { e.stopPropagation(); onUploadRoutine() }}>
                  Browse File
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs font-medium text-foreground mb-1">Supported formats</p>
                <p className="text-xs text-muted-foreground">UCAM XLSX — courses, days, and times parsed automatically</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">PDF support coming in a future release</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [user,          setUser]          = useState<AppUser | null>(null)
  const [page,          setPage]          = useState<NavPage>("dashboard")
  const [profileOpen,   setProfileOpen]   = useState(false)
  const [routineOpen,   setRoutineOpen]   = useState(false)
  const [chatMember,    setChatMember]    = useState<Member | null>(null)
  const [pagePerms,     setPagePerms]     = useState<Record<string, string[]>>(DEFAULT_PAGE_PERMS)
  const [featurePerms,  setFeaturePerms]  = useState<Record<string, string[]>>(DEFAULT_FEATURE_PERMS)

  const handleLogin = (u: AppUser) => {
    setUser(u)
    setPage(u.role === "member" ? "search" : "dashboard")
  }

  const handleSignOut = () => { setUser(null); setPage("dashboard") }

  if (!user) {
    return (
      <TooltipProvider>
        <AuthPage onLogin={handleLogin}/>
      </TooltipProvider>
    )
  }

  const pageContent = (): React.ReactNode => {
    if (!(pagePerms[user.role] ?? []).includes(page)) return <AccessDenied requiredRole="Team Manager"/>
    switch (page) {
      case "dashboard": return <DashboardPage onUploadRoutine={() => setRoutineOpen(true)}/>
      case "members":   return <MembersPage/>
      case "search":    return <SearchPage/>
      case "heatmap":   return <HeatmapPage/>
      case "skills":    return <SkillsPage/>
      case "settings":  return <SettingsPage onUploadRoutine={() => setRoutineOpen(true)}/>
    }
  }

  return (
    <UserContext.Provider value={{ user, pagePerms, setPagePerms, featurePerms, setFeaturePerms }}>
      <TooltipProvider>
        <div className="min-h-screen flex bg-background">
          <Sidebar page={page} setPage={setPage}/>
          <div className="flex-1 ml-56 flex flex-col min-h-screen">
            <TopBar page={page} onSignOut={handleSignOut} onOpenProfile={() => setProfileOpen(true)}/>
            <main className="flex-1 p-6">
              {pageContent()}
            </main>
          </div>
        </div>

        <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen}/>
        <MemberDialog
          member={chatMember}
          open={!!chatMember}
          onOpenChange={o => !o && setChatMember(null)}
          canManage={user.role === "org-owner" || user.role === "team-manager" || user.role === "subteam-manager"}
        />
        <AIChat members={MEMBERS} user={user} onMemberClick={m => setChatMember(m)}/>

        {/* Routine upload dialog (reused anywhere) */}
        <Dialog open={routineOpen} onOpenChange={setRoutineOpen}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Upload Class Routine</DialogTitle>
              <DialogDescription>Upload your UCAM XLSX to sync availability. Required before the semester deadline.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload size={28} className="mx-auto mb-3 text-muted-foreground"/>
                <p className="text-sm font-medium text-foreground mb-1">Click or drag your UCAM XLSX here</p>
                <p className="text-xs text-muted-foreground">Courses, days, and times are parsed automatically</p>
                <Button variant="outline" size="sm" className="mt-4">Browse File</Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRoutineOpen(false)}>Cancel</Button>
              <Button onClick={() => setRoutineOpen(false)}>Upload</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </UserContext.Provider>
  )
}
