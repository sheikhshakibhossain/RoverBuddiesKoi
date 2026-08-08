import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const deleted = await prisma.classRoutine.deleteMany({})
  console.log("✅ Deleted", deleted.count, "routine entries — DB is clean now")
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
