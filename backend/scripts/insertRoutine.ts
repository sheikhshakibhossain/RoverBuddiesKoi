// Direct insert script for ALL users using the XLSX file
import { PrismaClient } from "@prisma/client"
import xlsx from "xlsx"

const prisma = new PrismaClient()

const DAYS_MAP: Record<string, any> = {
  sun: "Sun", sunday: "Sun", mon: "Mon", monday: "Mon",
  tue: "Tue", tuesday: "Tue", wed: "Wed", wednesday: "Wed",
  thu: "Thu", thursday: "Thu", fri: "Fri", friday: "Fri",
  sat: "Sat", saturday: "Sat",
}

function convertTo24h(h: number, m: number, meridiem: string): string {
  if (meridiem === "AM") { if (h === 12) h = 0 }
  else { if (h !== 12) h += 12 }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function parseTimeRange(str: string) {
  str = str.trim()
  const m = str.match(/^(\d{1,2}):(\d{2}):(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2}):(AM|PM)$/i)
  if (m) return { startTime: convertTo24h(+m[1], +m[2], m[3].toUpperCase()), endTime: convertTo24h(+m[4], +m[5], m[6].toUpperCase()) }
  const s = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (s) return { startTime: convertTo24h(+s[1], +s[2], s[3].toUpperCase()), endTime: convertTo24h(+s[4], +s[5], s[6].toUpperCase()) }
  return null
}

async function insertForUser(userId: string, orgId: string, userName: string, slots: any[]) {
  // Get or create semester
  let semester = await prisma.semester.findFirst({ where: { organizationId: orgId, isActive: true } })
  if (!semester) {
    const now = new Date()
    const end = new Date(now); end.setMonth(end.getMonth() + 6)
    semester = await prisma.semester.create({
      data: { organizationId: orgId, name: "Current Semester", startDate: now, endDate: end, routineDeadline: end, isActive: true }
    })
    console.log(`  📅 Created semester: ${semester.name}`)
  }

  await prisma.classRoutine.deleteMany({ where: { userId, semesterId: semester.id } })

  for (const slot of slots) {
    await prisma.classRoutine.create({
      data: { userId, semesterId: semester.id, day: slot.day, startTime: slot.startTime, endTime: slot.endTime, course: slot.course, room: slot.room }
    })
  }
  console.log(`  ✅ Inserted ${slots.length} slots for ${userName}`)
}

async function main() {
  const xlsxPath = "C:\\Users\\Mahin\\Desktop\\RptStudentClassRoutine.xlsx"
  const targetEmail: string | undefined = process.env.TARGET_EMAIL

  console.log("📂 Reading:", xlsxPath)

  const wb = xlsx.readFile(xlsxPath, { raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" })

  // Find header
  let headerRowIdx = -1, colCode = -1, colTitle = -1, colDay = -1, colRoom = -1, colTime = -1
  for (let r = 0; r < 15; r++) {
    const row = rows[r]; if (!row) continue
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

  if (headerRowIdx === -1) { console.error("❌ Header not found"); process.exit(1) }

  // Parse slots
  const slots: any[] = []
  let lastCourse = "Class", lastRoom = ""
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]; if (!row || !row.length) continue
    const rawCode  = colCode  >= 0 ? String(row[colCode]  || "").trim() : ""
    const rawTitle = colTitle >= 0 ? String(row[colTitle] || "").trim() : ""
    const rawDay   = colDay   >= 0 ? String(row[colDay]   || "").trim() : ""
    const rawRoom  = colRoom  >= 0 ? String(row[colRoom]  || "").trim() : ""
    const rawTime  = colTime  >= 0 ? String(row[colTime]  || "").trim() : ""
    if (rawCode && rawCode.length >= 2) { lastCourse = rawTitle || rawCode; lastRoom = rawRoom }
    else if (rawTitle && rawTitle.length >= 2) { lastCourse = rawTitle; lastRoom = rawRoom }
    if (!rawDay) continue
    const day = DAYS_MAP[rawDay.toLowerCase()]; if (!day) continue
    if (!rawTime) continue
    const timeRange = parseTimeRange(rawTime); if (!timeRange) continue
    slots.push({ day, startTime: timeRange.startTime, endTime: timeRange.endTime, course: lastCourse, room: rawRoom || lastRoom || undefined })
  }

  console.log(`📋 ${slots.length} slots parsed\n`)

  // Get users
  const whereClause = targetEmail ? { email: targetEmail } : {}
  const users = await prisma.user.findMany({ where: whereClause })
  console.log(`👥 Found ${users.length} user(s):\n`)
  users.forEach((u, i) => console.log(`  [${i}] ${u.name} <${u.email}> (${u.role})`))
  console.log("")

  for (const user of users) {
    await insertForUser(user.id, user.organizationId, `${user.name} <${user.email}>`, slots)
  }

  console.log("\n🎉 All done!")
  await prisma.$disconnect()
}

main().catch(e => { console.error("Fatal:", e); prisma.$disconnect(); process.exit(1) })
