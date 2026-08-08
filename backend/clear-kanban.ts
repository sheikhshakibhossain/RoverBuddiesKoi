import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const deletedTasks = await prisma.task.deleteMany()
  console.log(`Deleted ${deletedTasks.count} tasks`)
  const deletedProjects = await prisma.project.deleteMany()
  console.log(`Deleted ${deletedProjects.count} projects`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
