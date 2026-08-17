import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function check() {
  const orgCount = await prisma.organization.count()
  const userCount = await prisma.user.count()
  const teamCount = await prisma.team.count()
  const semesterCount = await prisma.semester.count()
  const skillCount = await prisma.skill.count()
  const projectCount = await prisma.project.count()
  const taskCount = await prisma.task.count()
  
  console.log("DB Stats:", {
    organizations: orgCount,
    users: userCount,
    teams: teamCount,
    semesters: semesterCount,
    skills: skillCount,
    projects: projectCount,
    tasks: taskCount,
  })

  if (userCount > 0) {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        routines: true,
      },
    })
    console.log("\n=== REAL-TIME AVAILABILITY FOR ALL MEMBERS AT CURRENT DHAKA TIME ===")
    const { calculateAvailability, getDhakaTimeParts } = await import("../src/services/availability.js")
    const dhakaNow = getDhakaTimeParts()
    console.log(`Current Dhaka Time: ${dhakaNow.day} ${dhakaNow.timeStr24} (${dhakaNow.hours}:${dhakaNow.minutes.toString().padStart(2, "0")})`)
    for (const u of users) {
      const sched = u.routines.map(r => ({ day: r.day, startTime: r.startTime, endTime: r.endTime, course: r.course }))
      const avail = calculateAvailability(sched, dhakaNow.day, dhakaNow.timeStr24)
      const daySlots = u.routines.filter(r => r.day === dhakaNow.day)
      console.log(`- ${u.name.padEnd(28)} | ${dhakaNow.day} classes: ${daySlots.length} | Status: ${avail.status.padEnd(8)} | Next: ${avail.nextChange}`)
    }
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
