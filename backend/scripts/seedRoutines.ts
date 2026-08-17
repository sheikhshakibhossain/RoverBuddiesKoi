import { PrismaClient, DayOfWeek } from "@prisma/client"
import xlsx from "xlsx"
import fs from "fs"
import path from "path"

const prisma = new PrismaClient()

interface SlotDef {
  day: DayOfWeek
  startTime: string
  endTime: string
  course: string
  room?: string
}

const DAYS_MAP: Record<string, DayOfWeek> = {
  sun: "Sun", sunday: "Sun",
  mon: "Mon", monday: "Mon",
  tue: "Tue", tuesday: "Tue",
  wed: "Wed", wednesday: "Wed",
  thu: "Thu", thursday: "Thu",
  fri: "Fri", friday: "Fri",
  sat: "Sat", saturday: "Sat",
}

function convertTo24h(h: number, m: number, meridiem: string): string {
  if (meridiem === "AM") {
    if (h === 12) h = 0
  } else {
    if (h !== 12) h += 12
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function parseTimeRange(str: string) {
  str = str.trim()
  const uiuMatch = str.match(/^(\d{1,2}):(\d{2}):(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2}):(AM|PM)$/i)
  if (uiuMatch) {
    return {
      startTime: convertTo24h(+uiuMatch[1], +uiuMatch[2], uiuMatch[3].toUpperCase()),
      endTime: convertTo24h(+uiuMatch[4], +uiuMatch[5], uiuMatch[6].toUpperCase()),
    }
  }
  const stdMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (stdMatch) {
    return {
      startTime: convertTo24h(+stdMatch[1], +stdMatch[2], stdMatch[3].toUpperCase()),
      endTime: convertTo24h(+stdMatch[4], +stdMatch[5], stdMatch[6].toUpperCase()),
    }
  }
  return null
}

function parseXlsxSlots(filePath: string): SlotDef[] {
  if (!fs.existsSync(filePath)) return []
  const wb = xlsx.readFile(filePath, { raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" })

  let headerRowIdx = -1, colCode = -1, colTitle = -1, colDay = -1, colRoom = -1, colTime = -1
  for (let r = 0; r < 15; r++) {
    const row = rows[r]
    if (!row) continue
    let foundDay = false, foundTime = false
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || "").trim().toLowerCase()
      if (cell === "formal code" || cell === "course code") colCode = c
      if (cell === "course title" || cell === "subject") colTitle = c
      if (cell === "day") { colDay = c; foundDay = true }
      if (cell === "room" || cell === "venue") colRoom = c
      if (cell === "time slot" || cell === "time") { colTime = c; foundTime = true }
    }
    if (foundDay && foundTime) { headerRowIdx = r; break }
  }

  if (headerRowIdx === -1) return []

  const slots: SlotDef[] = []
  let lastCourse = "Class", lastRoom = ""
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row.length) continue
    const rawCode  = colCode  >= 0 ? String(row[colCode]  || "").trim() : ""
    const rawTitle = colTitle >= 0 ? String(row[colTitle] || "").trim() : ""
    const rawDay   = colDay   >= 0 ? String(row[colDay]   || "").trim() : ""
    const rawRoom  = colRoom  >= 0 ? String(row[colRoom]  || "").trim() : ""
    const rawTime  = colTime  >= 0 ? String(row[colTime]  || "").trim() : ""
    if (rawCode && rawCode.length >= 2) { lastCourse = rawTitle || rawCode; lastRoom = rawRoom }
    else if (rawTitle && rawTitle.length >= 2) { lastCourse = rawTitle; lastRoom = rawRoom }
    if (!rawDay) continue
    const day = DAYS_MAP[rawDay.toLowerCase()]
    if (!day) continue
    if (!rawTime) continue
    const timeRange = parseTimeRange(rawTime)
    if (!timeRange) continue
    slots.push({ day, startTime: timeRange.startTime, endTime: timeRange.endTime, course: lastCourse, room: rawRoom || lastRoom || undefined })
  }
  return slots
}

// Preset unique routines for other members to ensure realistic, diverse availability
const USER_PRESET_SCHEDULES: Record<string, SlotDef[]> = {
  // CSE Batch 242
  "msifat2420073@bscse.uiu.ac.bd": [
    { day: "Sat", startTime: "08:30", endTime: "09:50", course: "Data Structure and Algorithms", room: "312 Permanent Campus" },
    { day: "Tue", startTime: "08:30", endTime: "09:50", course: "Data Structure and Algorithms", room: "312 Permanent Campus" },
    { day: "Sat", startTime: "10:00", endTime: "11:20", course: "Linear Algebra and Matrices", room: "415 Permanent Campus" },
    { day: "Tue", startTime: "10:00", endTime: "11:20", course: "Linear Algebra and Matrices", room: "415 Permanent Campus" },
    { day: "Mon", startTime: "14:00", endTime: "16:30", course: "Data Structure and Algorithms Laboratory", room: "520 Permanent Campus" },
    { day: "Sun", startTime: "11:11", endTime: "12:30", course: "Physics II", room: "610 Permanent Campus" },
    { day: "Wed", startTime: "11:11", endTime: "12:30", course: "Physics II", room: "610 Permanent Campus" },
  ],
  // Team Manager
  "soikotmusfiqur@gmail.com": [
    { day: "Sun", startTime: "10:00", endTime: "11:20", course: "Web Programming", room: "428 Permanent Campus" },
    { day: "Wed", startTime: "10:00", endTime: "11:20", course: "Web Programming", room: "428 Permanent Campus" },
    { day: "Sat", startTime: "14:00", endTime: "16:30", course: "Web Programming Laboratory", room: "524 Permanent Campus" },
    { day: "Mon", startTime: "10:00", endTime: "11:20", course: "Machine Learning", room: "315 Permanent Campus" },
    { day: "Tue", startTime: "10:00", endTime: "11:20", course: "Machine Learning", room: "315 Permanent Campus" },
  ],
  // Subteam Manager
  "mtonmoy223703@bscse.uiu.ac.bd": [
    { day: "Sat", startTime: "08:30", endTime: "09:50", course: "Database Management Systems", room: "514 Permanent Campus" },
    { day: "Tue", startTime: "08:30", endTime: "09:50", course: "Database Management Systems", room: "514 Permanent Campus" },
    { day: "Wed", startTime: "14:00", endTime: "16:30", course: "Database Management Systems Laboratory", room: "920 Permanent Campus" },
    { day: "Sun", startTime: "13:00", endTime: "14:20", course: "Computer Networks", room: "416 Permanent Campus" },
    { day: "Wed", startTime: "13:00", endTime: "14:20", course: "Computer Networks", room: "416 Permanent Campus" },
  ],
  // EEE Member
  "asakib2330137@bseee.uiu.ac.bd": [
    { day: "Sat", startTime: "10:00", endTime: "11:20", course: "Electrical Circuits II", room: "702 Permanent Campus" },
    { day: "Tue", startTime: "10:00", endTime: "11:20", course: "Electrical Circuits II", room: "702 Permanent Campus" },
    { day: "Sun", startTime: "08:30", endTime: "09:50", course: "Electronics I", room: "705 Permanent Campus" },
    { day: "Wed", startTime: "08:30", endTime: "09:50", course: "Electronics I", room: "705 Permanent Campus" },
    { day: "Mon", startTime: "09:00", endTime: "11:30", course: "Electrical Circuits II Laboratory", room: "802 Permanent Campus" },
    { day: "Thu", startTime: "11:30", endTime: "14:00", course: "Electronics I Laboratory", room: "805 Permanent Campus" },
  ],
  // Mechanical Member
  "mimtiagehemal2002@gmail.com": [
    { day: "Sat", startTime: "11:30", endTime: "12:50", course: "Engineering Mechanics", room: "304 Permanent Campus" },
    { day: "Tue", startTime: "11:30", endTime: "12:50", course: "Engineering Mechanics", room: "304 Permanent Campus" },
    { day: "Sun", startTime: "10:00", endTime: "11:20", course: "Thermodynamics", room: "308 Permanent Campus" },
    { day: "Wed", startTime: "10:00", endTime: "11:20", course: "Thermodynamics", room: "308 Permanent Campus" },
    { day: "Mon", startTime: "14:00", endTime: "16:30", course: "CAD Drafting Laboratory", room: "410 Permanent Campus" },
  ],
  // CSE Batch 233
  "esara2330406@bscse.uiu.ac.bd": [
    { day: "Sat", startTime: "13:00", endTime: "14:20", course: "Artificial Intelligence", room: "518 Permanent Campus" },
    { day: "Tue", startTime: "13:00", endTime: "14:20", course: "Artificial Intelligence", room: "518 Permanent Campus" },
    { day: "Mon", startTime: "08:30", endTime: "11:00", course: "Artificial Intelligence Laboratory", room: "928 Permanent Campus" },
    { day: "Sun", startTime: "14:30", endTime: "15:50", course: "Computer Architecture", room: "412 Permanent Campus" },
    { day: "Wed", startTime: "14:30", endTime: "15:50", course: "Computer Architecture", room: "412 Permanent Campus" },
  ],
  // Subteam Manager
  "mchowdhury2230999@bscse.uiu.ac.bd": [
    { day: "Sun", startTime: "08:30", endTime: "09:50", course: "Microprocessor and Microcontrollers", room: "612 Permanent Campus" },
    { day: "Wed", startTime: "08:30", endTime: "09:50", course: "Microprocessor and Microcontrollers", room: "612 Permanent Campus" },
    { day: "Sat", startTime: "11:11", endTime: "13:40", course: "Microprocessor Laboratory", room: "915 Permanent Campus" },
    { day: "Mon", startTime: "11:11", endTime: "12:30", course: "Compiler Design", room: "420 Permanent Campus" },
    { day: "Thu", startTime: "11:11", endTime: "12:30", course: "Compiler Design", room: "420 Permanent Campus" },
  ],
  // CSE Batch 232
  "mmontaz2320091@bscse.uiu.ac.bd": [
    { day: "Sat", startTime: "10:00", endTime: "11:20", course: "Theory of Computation", room: "510 Permanent Campus" },
    { day: "Tue", startTime: "10:00", endTime: "11:20", course: "Theory of Computation", room: "510 Permanent Campus" },
    { day: "Sun", startTime: "11:30", endTime: "12:50", course: "Software Design Patterns", room: "512 Permanent Campus" },
    { day: "Wed", startTime: "11:30", endTime: "12:50", course: "Software Design Patterns", room: "512 Permanent Campus" },
    { day: "Thu", startTime: "09:00", endTime: "11:30", course: "Design Patterns Laboratory", room: "922 Permanent Campus" },
  ],
  // Member
  "mnebir2420135@gmail.com": [
    { day: "Sat", startTime: "14:30", endTime: "15:50", course: "Structured Programming", room: "302 Permanent Campus" },
    { day: "Tue", startTime: "14:30", endTime: "15:50", course: "Structured Programming", room: "302 Permanent Campus" },
    { day: "Sun", startTime: "10:00", endTime: "12:30", course: "Structured Programming Laboratory", room: "522 Permanent Campus" },
    { day: "Mon", startTime: "10:00", endTime: "11:20", course: "English Reading and Writing", room: "408 Permanent Campus" },
    { day: "Wed", startTime: "10:00", endTime: "11:20", course: "English Reading and Writing", room: "408 Permanent Campus" },
  ],
  // Org Owner
  "sheikhshakibpro@gmail.com": [
    { day: "Sat", startTime: "09:00", endTime: "10:20", course: "Senior Design Project I", room: "602 Permanent Campus" },
    { day: "Mon", startTime: "14:00", endTime: "15:20", course: "Senior Design Project I", room: "602 Permanent Campus" },
    { day: "Tue", startTime: "10:00", endTime: "11:20", course: "Cloud Computing", room: "516 Permanent Campus" },
    { day: "Wed", startTime: "10:00", endTime: "11:20", course: "Cloud Computing", room: "516 Permanent Campus" },
  ],
  // Electrical
  "hossain4arman@gmail.com": [
    { day: "Sat", startTime: "08:30", endTime: "09:50", course: "Signals and Systems", room: "706 Permanent Campus" },
    { day: "Tue", startTime: "08:30", endTime: "09:50", course: "Signals and Systems", room: "706 Permanent Campus" },
    { day: "Sun", startTime: "13:00", endTime: "15:30", course: "Signals and Systems Laboratory", room: "810 Permanent Campus" },
    { day: "Mon", startTime: "11:30", endTime: "12:50", course: "Complex Variables & Fourier Analysis", room: "414 Permanent Campus" },
    { day: "Wed", startTime: "11:30", endTime: "12:50", course: "Complex Variables & Fourier Analysis", room: "414 Permanent Campus" },
  ],
  // Member
  "tjubayer2410062@bscse.uiu.ac.bd": [
    { day: "Sat", startTime: "11:30", endTime: "12:50", course: "Discrete Mathematics", room: "310 Permanent Campus" },
    { day: "Tue", startTime: "11:30", endTime: "12:50", course: "Discrete Mathematics", room: "310 Permanent Campus" },
    { day: "Sun", startTime: "08:30", endTime: "09:50", course: "Digital Logic Design", room: "406 Permanent Campus" },
    { day: "Wed", startTime: "08:30", endTime: "09:50", course: "Digital Logic Design", room: "406 Permanent Campus" },
    { day: "Thu", startTime: "14:00", endTime: "16:30", course: "Digital Logic Design Laboratory", room: "526 Permanent Campus" },
  ],
  // Admin Org Owner
  "admin@gmail.com": [
    { day: "Sat", startTime: "10:00", endTime: "11:20", course: "Cyber Security", room: "608 Permanent Campus" },
    { day: "Tue", startTime: "10:00", endTime: "11:20", course: "Cyber Security", room: "608 Permanent Campus" },
    { day: "Sun", startTime: "14:00", endTime: "16:30", course: "Cyber Security Laboratory", room: "930 Permanent Campus" },
  ],
  // UI/UX
  "anindatalukder318@gmail.com": [
    { day: "Sat", startTime: "13:00", endTime: "14:20", course: "Human Computer Interaction", room: "508 Permanent Campus" },
    { day: "Tue", startTime: "13:00", endTime: "14:20", course: "Human Computer Interaction", room: "508 Permanent Campus" },
    { day: "Mon", startTime: "10:00", endTime: "12:30", course: "UI/UX Design Studio", room: "918 Permanent Campus" },
  ],
}

async function main() {
  console.log("🚀 Starting database routine seeding with distinct member schedules...")

  const org = await prisma.organization.findFirst()
  if (!org) {
    console.error("❌ No organization found. Please run prisma:seed first.")
    process.exit(1)
  }

  let semester = await prisma.semester.findFirst({ where: { organizationId: org.id, isActive: true } })
  if (!semester) {
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 6)
    semester = await prisma.semester.create({
      data: {
        organizationId: org.id,
        name: "Fall 2026",
        startDate: now,
        endDate: end,
        routineDeadline: end,
        isActive: true,
      },
    })
    console.log(`📅 Created semester: ${semester.name}`)
  }

  // Clear existing routines
  await prisma.classRoutine.deleteMany()
  console.log("🧹 Cleared old duplicated class routines.")

  // 1. Parse the XLSX file for the primary student
  const possiblePaths = [
    path.resolve(process.cwd(), "../RptStudentClassRoutine.xlsx"),
    path.resolve(process.cwd(), "RptStudentClassRoutine.xlsx"),
    "C:\\Users\\Mahin\\Desktop\\RptStudentClassRoutine.xlsx",
  ]
  const xlsxPath = possiblePaths.find((p) => fs.existsSync(p))
  let xlsxSlots: SlotDef[] = []
  if (xlsxPath) {
    xlsxSlots = parseXlsxSlots(xlsxPath)
    console.log(`📄 Parsed ${xlsxSlots.length} slots from ${xlsxPath}`)
  }

  const allUsers = await prisma.user.findMany()
  console.log(`👥 Found ${allUsers.length} users in database.\n`)

  for (const user of allUsers) {
    let slotsToInsert: SlotDef[] = []

    if (user.email === "mahinhasanupol@gmail.com") {
      // Primary user gets the full XLSX routine
      slotsToInsert = xlsxSlots
    } else if (USER_PRESET_SCHEDULES[user.email]) {
      // Preset distinct routine
      slotsToInsert = USER_PRESET_SCHEDULES[user.email]
    } else {
      // Members without preset have NO routine (testing "missing routine" restriction & filter)
      console.log(`  ⚪ ${user.name} <${user.email}> -> Left with 0 slots (No Routine / Missing)`)
      continue
    }

    for (const slot of slotsToInsert) {
      await prisma.classRoutine.create({
        data: {
          userId: user.id,
          semesterId: semester.id,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          course: slot.course,
          room: slot.room,
        },
      })
    }
    console.log(`  ✅ ${user.name} <${user.email}> -> Inserted ${slotsToInsert.length} distinct slots (including Saturday)`)
  }

  console.log("\n🎉 Seeding complete! Each member now has their own distinct database schedule.")
}

main()
  .catch((e) => {
    console.error("Fatal error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
