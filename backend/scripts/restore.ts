import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function restoreDatabase() {
  const backupFile = process.argv[2] || path.resolve(process.cwd(), "../backups/db_backup_latest.json")
  console.log(`Reading backup file from: ${backupFile}`)

  if (!fs.existsSync(backupFile)) {
    console.error(`Backup file not found: ${backupFile}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(backupFile, "utf8")
  const backup = JSON.parse(raw)
  const { data } = backup

  console.log(`Restoring database from backup dated: ${backup.exportedAt}...`)

  // 1. Organizations
  for (const org of data.organizations || []) {
    await prisma.organization.upsert({
      where: { id: org.id },
      create: org,
      update: org,
    })
  }

  // 2. Teams
  for (const team of data.teams || []) {
    await prisma.team.upsert({
      where: { id: team.id },
      create: team,
      update: team,
    })
  }

  // 3. Subteams
  for (const sub of data.subteams || []) {
    await prisma.subteam.upsert({
      where: { id: sub.id },
      create: sub,
      update: sub,
    })
  }

  // 4. Users
  for (const u of data.users || []) {
    const { subteams, skills, routines, ...userData } = u
    await prisma.user.upsert({
      where: { id: u.id },
      create: userData,
      update: userData,
    })
  }

  // 5. UserSubteams
  for (const ust of data.userSubteams || []) {
    await prisma.userSubteam.upsert({
      where: { userId_subteamId: { userId: ust.userId, subteamId: ust.subteamId } },
      create: ust,
      update: ust,
    })
  }

  // 6. Semesters
  for (const sem of data.semesters || []) {
    await prisma.semester.upsert({
      where: { id: sem.id },
      create: {
        ...sem,
        startDate: new Date(sem.startDate),
        endDate: new Date(sem.endDate),
        routineDeadline: new Date(sem.routineDeadline),
      },
      update: {
        ...sem,
        startDate: new Date(sem.startDate),
        endDate: new Date(sem.endDate),
        routineDeadline: new Date(sem.routineDeadline),
      },
    })
  }

  // 7. ClassRoutines
  for (const r of data.classRoutines || []) {
    await prisma.classRoutine.upsert({
      where: { id: r.id },
      create: r,
      update: r,
    })
  }

  // 8. Skills
  for (const s of data.skills || []) {
    await prisma.skill.upsert({
      where: { id: s.id },
      create: s,
      update: s,
    })
  }

  // 9. UserSkills
  for (const us of data.userSkills || []) {
    await prisma.userSkill.upsert({
      where: { id: us.id },
      create: us,
      update: us,
    })
  }

  // 10. Projects & Tasks
  for (const p of data.projects || []) {
    const { tasks, ...projData } = p
    await prisma.project.upsert({
      where: { id: p.id },
      create: projData,
      update: projData,
    })
  }

  for (const t of data.tasks || []) {
    await prisma.task.upsert({
      where: { id: t.id },
      create: t,
      update: t,
    })
  }

  console.log(`\n========================================`)
  console.log(`DATABASE RESTORE COMPLETED SUCCESSFULLY!`)
  console.log(`========================================`)
}

restoreDatabase()
  .catch((err) => {
    console.error("Restore failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
