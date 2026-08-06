import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Cleaning and initializing production database structure...")

  // Clean existing tables
  await prisma.userSkill.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.classRoutine.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.semester.deleteMany()
  await prisma.userSubteam.deleteMany()
  await prisma.user.deleteMany()
  await prisma.subteam.deleteMany()
  await prisma.team.deleteMany()
  await prisma.organization.deleteMany()

  // 1. Core Organization
  const org = await prisma.organization.create({
    data: {
      name: "CAIR Lab",
      code: "cair-lab",
    },
  })

  // 2. Teams & Subteams
  const umrt = await prisma.team.create({
    data: { name: "UMRT", organizationId: org.id, description: "Underwater Mars Rover Team" },
  })
  const urrt = await prisma.team.create({
    data: { name: "URRT", organizationId: org.id, description: "University Rover Rescue Team" },
  })
  const xyz = await prisma.team.create({
    data: { name: "Team XYZ", organizationId: org.id, description: "Advanced Projects Team" },
  })

  await prisma.subteam.create({ data: { name: "Software", teamId: umrt.id } })
  await prisma.subteam.create({ data: { name: "Electrical", teamId: umrt.id } })
  await prisma.subteam.create({ data: { name: "Mechanical", teamId: umrt.id } })

  await prisma.subteam.create({ data: { name: "Software", teamId: urrt.id } })
  await prisma.subteam.create({ data: { name: "Electrical", teamId: urrt.id } })
  await prisma.subteam.create({ data: { name: "Mechanical", teamId: urrt.id } })

  await prisma.subteam.create({ data: { name: "UI/UX", teamId: xyz.id } })
  await prisma.subteam.create({ data: { name: "Software", teamId: xyz.id } })

  // 3. Active Semester Configuration
  await prisma.semester.create({
    data: {
      organizationId: org.id,
      name: "Fall 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-12-31"),
      routineDeadline: new Date("2026-09-10"),
      isActive: true,
    },
  })

  // 4. Skills Catalog
  const skillNames = [
    "React", "TypeScript", "Python", "ROS", "PCB Design",
    "Embedded Systems", "CAD", "Machine Learning", "UI/UX", "DevOps"
  ]
  for (const sName of skillNames) {
    await prisma.skill.create({ data: { name: sName } })
  }

  console.log("Database successfully cleaned and structural setup complete!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
