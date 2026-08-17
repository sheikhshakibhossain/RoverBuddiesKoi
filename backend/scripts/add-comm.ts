import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function run() {
  const teams = await prisma.team.findMany()
  console.log(`Found ${teams.length} teams.`)
  for (const t of teams) {
    const existing = await prisma.subteam.findFirst({
      where: { name: "Communication", teamId: t.id },
    })
    if (!existing) {
      const created = await prisma.subteam.create({
        data: { name: "Communication", teamId: t.id },
      })
      console.log(`Added Communication subteam for team: ${t.name} (id: ${created.id})`)
    } else {
      console.log(`Communication subteam already exists for team: ${t.name}`)
    }
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
