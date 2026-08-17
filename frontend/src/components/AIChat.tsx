import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  MessageCircle, X, Send, Bot, CheckCircle2, XCircle,
  AlertCircle, Minus, Sparkles, Clock, TrendingUp, Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppUser } from "@/lib/user-context"
import { aiApi } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

type AvailStatus = "free" | "in-class" | "soon" | "missing"
type DayOfWeek   = "Sun" | "Mon" | "Tue" | "Wed" | "Thu"

interface ClassSlot { day: DayOfWeek; startTime: string; endTime: string; course: string; room?: string }
interface Member {
  id: string; name: string; initials: string; org: string; team: string; subteams: string[]
  status: AvailStatus; nextChange: string; currentClass?: string; remainingMin?: number
  skills: string[]; batch: string; whatsapp: string; role: string; schedule: ClassSlot[]
}

interface ChatMessage {
  id: string
  role: "user" | "bot"
  text: string
  members?: Member[]
  meta?: string
  timestamp: Date
}

// ─── NLP Engine ───────────────────────────────────────────────────────────────

const TEAMS    = ["UMRT","URRT","Team XYZ"]
const SUBTEAMS = ["Software","Mechanical","Electrical","Communication","Science","Media","UI/UX"]
const ALL_SKILLS = ["React","TypeScript","Python","ROS","Embedded Systems","PCB Design","CAD","Machine Learning","UI/UX","DevOps"]
const DAYS: DayOfWeek[] = ["Sun","Mon","Tue","Wed","Thu"]

const DAY_ALIASES: Record<string, DayOfWeek> = {
  sunday:"Sun", sun:"Sun", "0":"Sun",
  monday:"Mon", mon:"Mon", today:"Mon",
  tuesday:"Tue", tue:"Tue",
  wednesday:"Wed", wed:"Wed", tomorrow:"Wed",
  thursday:"Thu", thu:"Thu",
}

// Extract team name from query
function extractTeam(q: string): string | null {
  for (const t of TEAMS) {
    if (q.includes(t.toLowerCase())) return t
  }
  return null
}

// Extract subteam name
function extractSubteam(q: string): string | null {
  if (q.includes("comunication") || q.includes("communication") || q.includes("comm") || q.includes("comms")) {
    return "Communication"
  }
  for (const s of SUBTEAMS) {
    if (q.includes(s.toLowerCase())) return s
  }
  return null
}

// Extract skill
function extractSkill(q: string): string | null {
  for (const s of ALL_SKILLS) {
    if (q.includes(s.toLowerCase())) return s
  }
  return null
}

// Extract day
function extractDay(q: string): DayOfWeek | null {
  for (const [alias, day] of Object.entries(DAY_ALIASES)) {
    if (q.includes(alias)) return day
  }
  return null
}

// Extract time — handles "3pm", "3:00 pm", "15:00", "at 3", "after 3"
function extractTime(q: string): string | null {
  // 24-hour
  const m24 = q.match(/\b(\d{1,2}):(\d{2})\b/)
  if (m24) {
    const h = m24[1].padStart(2,"0")
    return `${h}:${m24[2]}`
  }
  // 12-hour with am/pm
  const m12 = q.match(/\b(\d{1,2})\s*(am|pm)\b/)
  if (m12) {
    let h = parseInt(m12[1])
    if (m12[2] === "pm" && h !== 12) h += 12
    if (m12[2] === "am" && h === 12) h = 0
    return `${String(h).padStart(2,"0")}:00`
  }
  // "at 3", "after 3" — assume PM if 1–8
  const mat = q.match(/\b(?:at|after|around|by)\s+(\d{1,2})\b/)
  if (mat) {
    let h = parseInt(mat[1])
    if (h < 9) h += 12
    return `${String(h).padStart(2,"0")}:00`
  }
  return null
}

// Extract batch year
function extractBatch(q: string): string | null {
  const m = q.match(/\b(20\d{2})\b/)
  return m ? m[1] : null
}

// Check if a member is free at a given day/time
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

// Find best common meeting slot for two groups
function bestCommonSlot(groupA: Member[], groupB: Member[]): string | null {
  const hours = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"]
  const days: DayOfWeek[] = ["Sun","Mon","Tue","Wed","Thu"]
  let bestScore = -1
  let bestSlot: string | null = null
  for (const day of days) {
    for (const h of hours) {
      const freeA = groupA.filter(m => isFreeAt(m, day, h)).length
      const freeB = groupB.filter(m => isFreeAt(m, day, h)).length
      const score = freeA + freeB
      if (score > bestScore && freeA > 0 && freeB > 0) {
        bestScore = score
        bestSlot = `${day} at ${h} (${freeA}/${groupA.length} + ${freeB}/${groupB.length} free)`
      }
    }
  }
  return bestSlot
}

// Intent detection helpers
function matchesAny(q: string, patterns: string[]): boolean {
  return patterns.some(p => q.includes(p))
}

// ─── Core NLP resolver ────────────────────────────────────────────────────────

interface NLPResult {
  answer: string
  members: Member[]
  meta?: string
}

export function resolveQuery(input: string, members: Member[], userRole: string): NLPResult {
  const q = input.toLowerCase().trim()

  const team    = extractTeam(q)
  const subteam = extractSubteam(q)
  const skill   = extractSkill(q)
  const day     = extractDay(q)
  const time    = extractTime(q)
  const batch   = extractBatch(q)

  let pool = [...members]
  if (team)    pool = pool.filter(m => m.team === team)
  if (subteam) pool = pool.filter(m => m.subteams.includes(subteam))
  if (batch)   pool = pool.filter(m => m.batch === batch)

  // ── Intent: greeting ──────────────────────────────────────────────────────
  if (matchesAny(q, ["hello","hi","hey","what can you","help","what do you do"])) {
    return {
      answer: "Hi! I can help you find available members. Try asking:\n• Who is free right now?\n• Find React members in UMRT\n• Who is free Wednesday at 3pm?\n• Which team has the highest availability?\n• When can Software and Mechanical meet?",
      members: [],
    }
  }

  // ── Intent: who is free right now ────────────────────────────────────────
  if (matchesAny(q, ["free now","free right now","available now","currently free","who is free","who's free","who are free"])) {
    if (!matchesAny(q, ["after","at","on","pm","am",":"])) {
      const free = pool.filter(m => m.status === "free")
      if (free.length === 0) return { answer: `No members are free right now${subteam ? ` in ${subteam}` : team ? ` in ${team}` : ""}.`, members: [] }
      const ctx = [subteam, team].filter(Boolean).join(" · ") || "all teams"
      return {
        answer: `**${free.length}** member${free.length !== 1 ? "s" : ""} free right now in ${ctx}:`,
        members: free,
        meta: `${free.length} free · ${pool.length - free.length} unavailable`,
      }
    }
  }

  // ── Intent: in class / busy ───────────────────────────────────────────────
  if (matchesAny(q, ["in class","busy","unavailable","who is busy","who's in class"])) {
    const busy = pool.filter(m => m.status === "in-class")
    if (busy.length === 0) return { answer: "No members are currently in class.", members: [] }
    return {
      answer: `**${busy.length}** member${busy.length !== 1 ? "s" : ""} currently in class:`,
      members: busy,
      meta: busy.map(m => `${m.name} — ${m.currentClass} (${m.remainingMin}m left)`).join("\n"),
    }
  }

  // ── Intent: becoming free / free soon ────────────────────────────────────
  if (matchesAny(q, ["becoming free","will be free","free soon","free next","class ending","finishing class"])) {
    const becoming = pool
      .filter(m => m.status === "in-class" && m.remainingMin !== undefined)
      .sort((a,b) => (a.remainingMin ?? 99) - (b.remainingMin ?? 99))
    if (becoming.length === 0) return { answer: "No members finishing class soon.", members: [] }
    return {
      answer: `**${becoming.length}** member${becoming.length !== 1 ? "s" : ""} becoming free soon:`,
      members: becoming,
      meta: becoming.map(m => `${m.name} — ${m.remainingMin}m remaining`).join("\n"),
    }
  }

  // ── Intent: no routine / missing ─────────────────────────────────────────
  if (matchesAny(q, ["no routine","missing routine","no schedule","routine missing","not uploaded","expired"])) {
    const missing = pool.filter(m => m.status === "missing")
    if (missing.length === 0) return { answer: "All members have uploaded their routine.", members: [] }
    return {
      answer: `**${missing.length}** member${missing.length !== 1 ? "s" : ""} with missing routine:`,
      members: missing,
    }
  }

  // ── Intent: best meeting time (two subteams) ──────────────────────────────
  const meetMatch = q.match(/(?:when can|best time|schedule.*meeting|meet together|common.*time)/)
  if (meetMatch) {
    // Try to find two subteams mentioned
    const mentioned = SUBTEAMS.filter(s => q.includes(s.toLowerCase()))
    if (mentioned.length >= 2) {
      const groupA = members.filter(m => m.subteams.includes(mentioned[0]))
      const groupB = members.filter(m => m.subteams.includes(mentioned[1]))
      const slot = bestCommonSlot(groupA, groupB)
      if (slot) {
        return {
          answer: `Best meeting time for **${mentioned[0]}** and **${mentioned[1]}**:\n\n📅 ${slot}`,
          members: [],
          meta: "Based on weekly class schedules",
        }
      }
      return { answer: `Could not find a common free slot for ${mentioned[0]} and ${mentioned[1]}.`, members: [] }
    }
    // Single team best time
    if (pool.length > 0) {
      const hours = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"]
      const days: DayOfWeek[] = ["Sun","Mon","Tue","Wed","Thu"]
      let best = { day:"Mon" as DayOfWeek, hour:"09:00", count:0 }
      for (const d of days) {
        for (const h of hours) {
          const count = pool.filter(m => isFreeAt(m, d, h)).length
          if (count > best.count) best = { day:d, hour:h, count }
        }
      }
      const ctx = subteam ?? team ?? "this group"
      return {
        answer: `Best time for **${ctx}** to meet:\n\n📅 ${best.day} at ${best.hour} — ${best.count}/${pool.length} members free`,
        members: pool.filter(m => isFreeAt(m, best.day, best.hour)),
        meta: `${best.count} of ${pool.length} can attend`,
      }
    }
  }

  // ── Intent: highest availability team ────────────────────────────────────
  if (matchesAny(q, ["highest availability","most available","most free","best team","which team"])) {
    const teamStats = TEAMS.map(t => {
      const tm = members.filter(m => m.team === t)
      const free = tm.filter(m => m.status === "free").length
      return { team: t, free, total: tm.length, pct: Math.round((free/Math.max(tm.length,1))*100) }
    }).sort((a,b) => b.pct - a.pct)
    const best = teamStats[0]
    return {
      answer: `**${best.team}** has the highest availability right now:\n\n${teamStats.map(t => `• ${t.team}: ${t.free}/${t.total} free (${t.pct}%)`).join("\n")}`,
      members: members.filter(m => m.team === best.team && m.status === "free"),
      meta: `Ranked by % free`,
    }
  }

  // ── Intent: subteam availability comparison ───────────────────────────────
  if (matchesAny(q, ["which subteam","subteam availability","compare subteam"])) {
    const subStats = SUBTEAMS.map(s => {
      const sm = pool.filter(m => m.subteams.includes(s))
      const free = sm.filter(m => m.status === "free").length
      return { sub: s, free, total: sm.length, pct: Math.round((free/Math.max(sm.length,1))*100) }
    }).filter(s => s.total > 0).sort((a,b) => b.pct - a.pct)
    const best = subStats[0]
    return {
      answer: `**${best.sub}** subteam is most available right now:\n\n${subStats.map(s => `• ${s.sub}: ${s.free}/${s.total} free (${s.pct}%)`).join("\n")}`,
      members: pool.filter(m => m.subteams.includes(best.sub) && m.status === "free"),
      meta: "Ranked by % free",
    }
  }

  // ── Intent: free on day at time ───────────────────────────────────────────
  if (day && time) {
    const free = pool.filter(m => isFreeAt(m, day, time))
    const ctx = [subteam ?? team, `${day} at ${time}`].filter(Boolean).join(", ")
    if (free.length === 0) return { answer: `No members are free on **${day} at ${time}**${subteam ? ` in ${subteam}` : team ? ` in ${team}` : ""}.`, members: [] }
    return {
      answer: `**${free.length}** member${free.length !== 1 ? "s" : ""} free on ${ctx}:`,
      members: free,
      meta: `Based on weekly class schedules`,
    }
  }

  // Just day (any time)
  if (day && !time) {
    const wholeDayFree = pool.filter(m => {
      const slots = m.schedule.filter(s => s.day === day)
      return slots.length === 0 && m.status !== "missing"
    })
    const hasClass = pool.filter(m => m.schedule.some(s => s.day === day))
    return {
      answer: `On **${day}**: ${wholeDayFree.length} members have no classes, ${hasClass.length} have at least one class.${wholeDayFree.length > 0 ? " Showing members with no classes:" : ""}`,
      members: wholeDayFree,
    }
  }

  // ── Intent: skill-based search ────────────────────────────────────────────
  if (skill) {
    const withSkill = pool.filter(m => m.skills.includes(skill))
    const freeWithSkill = withSkill.filter(m => m.status === "free")

    if (matchesAny(q, ["free","available","now"])) {
      if (freeWithSkill.length === 0) return { answer: `No ${skill} members are free right now.`, members: [] }
      return {
        answer: `**${freeWithSkill.length}** ${skill} member${freeWithSkill.length !== 1 ? "s" : ""} free right now:`,
        members: freeWithSkill,
        meta: `${withSkill.length} total with ${skill} skill`,
      }
    }

    if (withSkill.length === 0) return { answer: `No members found with **${skill}** skill${team ? ` in ${team}` : ""}.`, members: [] }
    return {
      answer: `**${withSkill.length}** member${withSkill.length !== 1 ? "s" : ""} with **${skill}**:`,
      members: withSkill,
      meta: `${freeWithSkill.length} currently free`,
    }
  }

  // ── Intent: find N members ────────────────────────────────────────────────
  const numMatch = q.match(/(?:find|get|need|give me)\s+(\w+)\s+(?:available|free)?\s*members?/)
  if (numMatch) {
    const wordToNum: Record<string,number> = { one:1,two:2,three:3,four:4,five:5,a:1,an:1 }
    const n = parseInt(numMatch[1]) || wordToNum[numMatch[1]] || 2
    const free = pool.filter(m => m.status === "free").slice(0, n)
    if (free.length === 0) return { answer: "No free members found matching your criteria.", members: [] }
    return {
      answer: `Here ${free.length === 1 ? "is" : "are"} **${free.length}** available member${free.length !== 1 ? "s" : ""}:`,
      members: free,
    }
  }

  // ── Intent: subteam/team free count ──────────────────────────────────────
  if (subteam || team) {
    const free = pool.filter(m => m.status === "free")
    const ctx  = subteam ?? team
    if (pool.length === 0) return { answer: `No members found in **${ctx}**.`, members: [] }
    return {
      answer: `**${free.length}** of ${pool.length} ${ctx} members are free right now:`,
      members: free,
      meta: `${pool.filter(m=>m.status==="in-class").length} in class · ${pool.filter(m=>m.status==="soon").length} class soon`,
    }
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    answer: "I didn't quite understand that. Try asking:\n• *Who is free in Software?*\n• *Find React members*\n• *Who is free on Wednesday at 4pm?*\n• *When can Software and Mechanical meet?*\n• *Which team has the highest availability?*",
    members: [],
  }
}

// ─── Quick suggestions ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Who is free right now?",
  "Find React members",
  "Who is free Wednesday at 4pm?",
  "Which team has highest availability?",
  "When can Software and Mechanical meet?",
  "Who will be free next?",
  "Find 2 available Software members",
  "Who has no routine uploaded?",
]

// ─── Status icon helper ───────────────────────────────────────────────────────

function StatusDot({ status }: { status: AvailStatus }) {
  const map = {
    free:       { cls:"bg-success",          icon:<CheckCircle2 size={10}/>, label:"Free" },
    "in-class": { cls:"bg-destructive",      icon:<XCircle size={10}/>,     label:"In Class" },
    soon:       { cls:"bg-warning",          icon:<AlertCircle size={10}/>, label:"Soon" },
    missing:    { cls:"bg-muted-foreground", icon:<Minus size={10}/>,       label:"Missing" },
  }
  const m = map[status]
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full", {
      "bg-success/15 text-success":               status === "free",
      "bg-destructive/15 text-destructive":        status === "in-class",
      "bg-warning/15 text-warning":               status === "soon",
      "bg-muted/60 text-muted-foreground":         status === "missing",
    })}>
      {m.icon} {m.label}
    </span>
  )
}

// ─── Message renderer ─────────────────────────────────────────────────────────

function BotMessage({ msg, onMemberClick }: { msg: ChatMessage; onMemberClick: (m: Member) => void }) {
  function renderText(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g)
    return parts.map((p, i) =>
      i % 2 === 1
        ? <strong key={i} className="font-semibold text-foreground">{p}</strong>
        : <span key={i}>{p}</span>
    )
  }

  return (
    <div className="flex items-start gap-2.5 max-w-full">
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={13} className="text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed"
          style={{ background:"oklch(0.40 0.007 285)", border:"1px solid oklch(0.50 0.008 285)" }}>
          <p className="whitespace-pre-line text-foreground/90">{renderText(msg.text)}</p>
        </div>

        {/* Member result cards — clickable */}
        {msg.members && msg.members.length > 0 && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {msg.members.map(m => (
              <button
                key={m.id}
                onClick={() => onMemberClick(m)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-all duration-150 group"
                style={{ background:"oklch(0.38 0.007 285)", border:"1px solid oklch(0.50 0.008 285)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "oklch(0.46 0.008 285)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "oklch(0.58 0.008 285)"
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "oklch(0.38 0.007 285)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "oklch(0.50 0.008 285)"
                }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background:"oklch(0.52 0.008 285)", color:"oklch(0.95 0 0)" }}>
                  {m.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate group-hover:underline underline-offset-2">{m.name}</p>
                  <p className="text-muted-foreground truncate">{m.team} · {m.subteams.join(", ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusDot status={m.status} />
                  {m.status === "in-class" && m.remainingMin !== undefined && (
                    <span className="text-[9px] font-mono text-destructive flex items-center gap-0.5">
                      <Clock size={8}/>{m.remainingMin}m
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {msg.meta && (
          <p className="text-[10px] text-muted-foreground/60 font-mono px-0.5">{msg.meta}</p>
        )}
      </div>
    </div>
  )
}

function UserMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm"
        style={{ background:"oklch(0.96 0 0)", color:"oklch(0.12 0.005 285)" }}>
        {msg.text}
      </div>
    </div>
  )
}

// ─── Main Chat Component ──────────────────────────────────────────────────────

interface AIChatProps {
  members: Member[]
  user: AppUser
  onMemberClick: (m: Member) => void
}

const WELCOME_MSG: ChatMessage = {
  id: "welcome",
  role: "bot",
  text: "Hi! I'm your AI assistant. Ask me anything about member availability, skills, or scheduling.\n\nTry: *\"Who is free right now?\"* or *\"When can Software and Mechanical meet?\"*",
  members: [],
  timestamp: new Date(),
}

export function AIChat({ members, user, onMemberClick }: AIChatProps) {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG])
  const [input,    setInput]    = useState("")
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: text.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setThinking(true)

    try {
      const res = await aiApi.sendChatMessage(text)
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: res.reply,
        members: [],
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      const result = resolveQuery(text, members, user.role)
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: result.answer,
        members: result.members,
        meta: result.meta,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
    } finally {
      setThinking(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <>
      {/* ── Chat panel ── */}
      <div
        className={cn(
          "fixed z-50 transition-all duration-300 origin-bottom-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ width: 390, bottom: 84, right: 24 }}
      >
        <div
          className="flex flex-col rounded-2xl overflow-hidden"
          style={{
            height: 540,
            background: "oklch(0.32 0.007 285)",
            border: "1.5px solid oklch(0.46 0.008 285)",
            boxShadow: "0 24px 64px oklch(0 0 0 / 0.8), 0 0 0 1px oklch(0.46 0.008 285)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0"
            style={{ borderColor:"oklch(0.46 0.008 285)", background:"oklch(0.26 0.007 285)" }}>
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground leading-none">AI Assistant</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">RoverBuddies · Natural language search</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Online</span>
            </div>
            <button onClick={() => setOpen(false)} className="ml-2 text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            <div className="space-y-4">
              {messages.map(msg =>
                msg.role === "bot"
                  ? <BotMessage key={msg.id} msg={msg} onMemberClick={onMemberClick} />
                  : <UserMessage key={msg.id} msg={msg} />
              )}
              {thinking && (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot size={13} className="text-primary-foreground" />
                  </div>
                  <div className="flex gap-1 px-3.5 py-3 rounded-2xl rounded-tl-sm"
                    style={{ background:"oklch(0.40 0.007 285)", border:"1px solid oklch(0.50 0.008 285)" }}>
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                        style={{ animationDelay:`${i*120}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Predefined questions — ALWAYS visible */}
          <div className="px-4 py-2 shrink-0 border-t" style={{ borderColor: "oklch(0.40 0.008 285)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-muted-foreground/70 font-semibold tracking-wider uppercase flex items-center gap-1">
                <Sparkles size={10} className="text-primary"/> Suggested Questions
              </p>
              <span className="text-[9px] text-muted-foreground/40 font-mono">1-click ask</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap text-foreground/80 hover:text-foreground hover:border-primary/60 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                  style={{ borderColor: "oklch(0.50 0.008 285)", background: "oklch(0.38 0.007 285)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 pb-4 shrink-0">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background:"oklch(0.26 0.007 285)", border:"1px solid oklch(0.46 0.008 285)" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about availability, skills, scheduling…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                disabled={thinking}
              />
              <button
                type="submit"
                disabled={!input.trim() || thinking}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0",
                  input.trim() && !thinking
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-secondary text-muted-foreground/40"
                )}
              >
                <Send size={13} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Floating trigger button ── */}

      {/* Pulse ring — only when closed, uses --primary (white) */}
      {!open && (
        <span
          className="fixed z-40 rounded-full pointer-events-none"
          style={{
            bottom: 22,
            right: 22,
            width: 52,
            height: 52,
            border: "2px solid var(--primary)",
            opacity: 0,
            animation: "ai-pulse 2.4s ease-out infinite",
          }}
        />
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label="AI Assistant"
        className={cn(
          "fixed z-50 flex items-center gap-2 font-semibold text-sm rounded-full px-4 h-11",
          "transition-all duration-200 hover:scale-105 active:scale-95 select-none",
          open
            ? "bg-secondary text-secondary-foreground border border-border hover:bg-accent"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
        style={{
          bottom: 24,
          right: 24,
          boxShadow: open
            ? "0 4px 16px oklch(0 0 0 / 0.4)"
            : "0 0 0 1px var(--border), 0 8px 28px oklch(0 0 0 / 0.55), 0 0 24px var(--primary)",
        }}
      >
        {open ? (
          <><X size={15} /> Close</>
        ) : (
          <><Sparkles size={14} /> Ask AI</>
        )}
      </button>

      {/* Pulse keyframe */}
      <style>{`
        @keyframes ai-pulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          80%  { transform: scale(2.0); opacity: 0; }
          100% { transform: scale(2.0); opacity: 0; }
        }
      `}</style>
    </>
  )
}
