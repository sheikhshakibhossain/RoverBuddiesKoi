import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const before = await prisma.user.count()
  const deleted = await prisma.user.deleteMany({})
  const after = await prisma.user.count()

  console.log("Deleted users:", deleted.count)
  console.log("Users before:", before)
  console.log("Users after:", after)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
