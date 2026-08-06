import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function run() {
  await prisma.$executeRaw`UPDATE "User" SET role = "requestedRole" WHERE "requestedRole" IS NOT NULL;`
  console.log("Updated roles successfully.")
}
run().finally(() => prisma.$disconnect())
