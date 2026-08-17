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
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true } })
    console.log("Users:", users)
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
