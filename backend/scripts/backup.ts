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

  // Full backup
  fs.writeFileSync(timestampFile, JSON.stringify(backupData, null, 2), "utf8")
  fs.writeFileSync(latestFile, JSON.stringify(backupData, null, 2), "utf8")

  // Individual JSON exports
  fs.writeFileSync(path.join(backupDir, "members.json"), JSON.stringify(users, null, 2), "utf8")
  fs.writeFileSync(path.join(backupDir, "routines.json"), JSON.stringify(classRoutines, null, 2), "utf8")
  fs.writeFileSync(path.join(backupDir, "skills.json"), JSON.stringify(skills, null, 2), "utf8")
  fs.writeFileSync(path.join(backupDir, "teams.json"), JSON.stringify(teams, null, 2), "utf8")
  fs.writeFileSync(path.join(backupDir, "subteams.json"), JSON.stringify(subteams, null, 2), "utf8")
  fs.writeFileSync(path.join(backupDir, "projects.json"), JSON.stringify(projects, null, 2), "utf8")

  // CSV for members
  const memberHeaders = "ID,Name,Initials,Email,Role,Batch,WhatsApp,TeamId,CreatedAt\n"
  const memberRows = users.map(u => 
    `"${u.id}","${u.name}","${u.initials}","${u.email}","${u.role}","${u.batch}","${u.whatsapp}","${u.teamId || ''}","${u.createdAt}"`
  ).join("\n")
  fs.writeFileSync(path.join(backupDir, "members.csv"), memberHeaders + memberRows, "utf8")

  // CSV for routines
  const routineHeaders = "ID,UserId,SemesterId,Day,StartTime,EndTime,Course,Room,CreatedAt\n"
  const routineRows = classRoutines.map(r => 
    `"${r.id}","${r.userId}","${r.semesterId}","${r.day}","${r.startTime}","${r.endTime}","${r.course}","${r.room || ''}","${r.createdAt}"`
  ).join("\n")
  fs.writeFileSync(path.join(backupDir, "routines.csv"), routineHeaders + routineRows, "utf8")

  console.log(`\n========================================`)
  console.log(`ALL DATA BACKED UP & EXPORTED RIGHT NOW!`)
  console.log(`========================================`)
  console.log(`Records Summary:`)
  console.log(`- Members/Users: ${users.length}`)
  console.log(`- Class Routines: ${classRoutines.length}`)
  console.log(`- User Skills: ${userSkills.length}`)
  console.log(`- Skills: ${skills.length}`)
  console.log(`- Teams: ${teams.length}`)
  console.log(`- Subteams: ${subteams.length}`)
  console.log(`- Projects: ${projects.length}`)
  console.log(`\nExports Generated in /backups:`)
  console.log(`- db_backup_latest.json (Complete DB bundle)`)
  console.log(`- members.json & members.csv`)
  console.log(`- routines.json & routines.csv`)
  console.log(`- skills.json, teams.json, subteams.json, projects.json`)
}

backupDatabase()
  .catch((err) => {
    console.error("Backup failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
