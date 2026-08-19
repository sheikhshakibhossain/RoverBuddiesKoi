import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function backupDatabase() {
  console.log("Connecting to database...")

  let retries = 5
  while (retries > 0) {
    try {
      await prisma.$connect()
      console.log("Connected successfully to PostgreSQL database.")
      break
    } catch (e: any) {
      console.log(`Connection attempt failed (${e.message}). Retrying in 3s... (${retries} retries left)`)
      retries--
      if (retries === 0) throw e
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  console.log("Reading tables...")

  const organizations = await prisma.organization.findMany().catch(e => { console.warn("Failed reading organizations:", e.message); return [] })
  const teams = await prisma.team.findMany().catch(e => { console.warn("Failed reading teams:", e.message); return [] })
  const subteams = await prisma.subteam.findMany().catch(e => { console.warn("Failed reading subteams:", e.message); return [] })
  const users = await prisma.user.findMany({
    include: {
      subteams: true,
      skills: true,
      routines: true,
    },
  }).catch(e => { console.warn("Failed reading users:", e.message); return [] })
  const userSubteams = await prisma.userSubteam.findMany().catch(e => { console.warn("Failed reading userSubteams:", e.message); return [] })
  const semesters = await prisma.semester.findMany().catch(e => { console.warn("Failed reading semesters:", e.message); return [] })
  const classRoutines = await prisma.classRoutine.findMany().catch(e => { console.warn("Failed reading classRoutines:", e.message); return [] })
  const skills = await prisma.skill.findMany().catch(e => { console.warn("Failed reading skills:", e.message); return [] })
  const userSkills = await prisma.userSkill.findMany().catch(e => { console.warn("Failed reading userSkills:", e.message); return [] })
  const projects = await prisma.project.findMany({
    include: { tasks: true },
  }).catch(e => { console.warn("Failed reading projects:", e.message); return [] })
  const tasks = await prisma.task.findMany().catch(e => { console.warn("Failed reading tasks:", e.message); return [] })
  const heatmapSnapshots = await prisma.heatmapSnapshot.findMany().catch(e => { console.warn("Failed reading heatmapSnapshots:", e.message); return [] })

  const backupData = {
    exportedAt: new Date().toISOString(),
    stats: {
      organizations: organizations.length,
      teams: teams.length,
      subteams: subteams.length,
      users: users.length,
      userSubteams: userSubteams.length,
      semesters: semesters.length,
      classRoutines: classRoutines.length,
      skills: skills.length,
      userSkills: userSkills.length,
      projects: projects.length,
      tasks: tasks.length,
      heatmapSnapshots: heatmapSnapshots.length,
    },
    data: {
      organizations,
      teams,
      subteams,
      users,
      userSubteams,
      semesters,
      classRoutines,
      skills,
      userSkills,
      projects,
      tasks,
      heatmapSnapshots,
    },
  }

  const backupDir = path.resolve(process.cwd(), "../backups")
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const timestampFile = path.join(backupDir, `db_backup_${timestamp}.json`)
  const latestFile = path.join(backupDir, "db_backup_latest.json")

  fs.writeFileSync(timestampFile, JSON.stringify(backupData, null, 2), "utf8")
  fs.writeFileSync(latestFile, JSON.stringify(backupData, null, 2), "utf8")

  console.log(`\n========================================`)
  console.log(`DATABASE BACKUP COMPLETED SUCCESSFULLY!`)
  console.log(`========================================`)
  console.log(`Stats:`)
  console.log(`- Users: ${users.length}`)
  console.log(`- Routines: ${classRoutines.length}`)
  console.log(`- Skills: ${skills.length}`)
  console.log(`- UserSkills: ${userSkills.length}`)
  console.log(`- Teams: ${teams.length}`)
  console.log(`- Subteams: ${subteams.length}`)
  console.log(`- Projects: ${projects.length}`)
  console.log(`- Tasks: ${tasks.length}`)
  console.log(`\nFiles saved:`)
  console.log(`1. ${timestampFile}`)
  console.log(`2. ${latestFile}`)
}

backupDatabase()
  .catch((err) => {
    console.error("Backup failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
