import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js"
import { Role } from "@prisma/client"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isManager(role: Role): boolean {
  return role === Role.ORG_OWNER || role === Role.TEAM_MANAGER
}

function serializeTask(t: any) {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId ?? null,
    assigneeLabel: t.assigneeLabel ?? (t.assignee?.name ?? ""),
    due: t.due ?? "",
    tags: t.tags ?? [],
    createdById: t.createdById,
    createdByName: t.createdBy?.name ?? "",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

function serializeProject(p: any) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    color: p.color,
    organizationId: p.organizationId,
    teamId: p.teamId ?? null,
    createdById: p.createdById,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

// ─── Auto-seed default projects and tasks if empty ───────────────────────────
async function ensureDefaultProjectsAndTasks(user: NonNullable<Request["user"]>) {
  const existingCount = await prisma.project.count({
    where: { organizationId: user.organizationId },
  })

  if (existingCount === 0) {
    const p1 = await prisma.project.create({
      data: {
        organizationId: user.organizationId,
        teamId: user.teamId,
        name: "Rover Control System",
        description: "Core telemetry, obstacle avoidance, and navigation modules",
        color: "#6366f1",
        createdById: user.id,
      },
    })
    const p2 = await prisma.project.create({
      data: {
        organizationId: user.organizationId,
        teamId: user.teamId,
        name: "Hardware Integration",
        description: "PCB design, power distribution, and mechanical assembly",
        color: "#f59e0b",
        createdById: user.id,
      },
    })

    await prisma.task.createMany({
      data: [
        {
          projectId: p1.id,
          title: "Autonomous Navigation Module",
          description: "Implement obstacle avoidance using LiDAR sensor and ROS2 pipelines",
          status: "In Progress",
          priority: "High",
          assigneeLabel: user.name || "Software Lead",
          due: "Aug 15",
          tags: ["ROS2", "Python", "LiDAR"],
          createdById: user.id,
        },
        {
          projectId: p2.id,
          title: "PCB Power Distribution Rail",
          description: "Design 12V / 5V dual rail step-down buck converter",
          status: "To Do",
          priority: "Critical",
          assigneeLabel: "Electrical Team",
          due: "Aug 20",
          tags: ["PCB", "KiCad", "Power"],
          createdById: user.id,
        },
        {
          projectId: p2.id,
          title: "Chassis Stress Simulation",
          description: "Run FEA load analysis on rover chassis joints",
          status: "Completed",
          priority: "Medium",
          assigneeLabel: "Mechanical Team",
          due: "Aug 02",
          tags: ["CAD", "FEA"],
          createdById: user.id,
        },
        {
          projectId: p1.id,
          title: "Real-Time Telemetry Stream",
          description: "Stream live IMU and motor velocity over WebSocket to frontend dashboard",
          status: "To Do",
          priority: "High",
          assigneeLabel: user.name || "Lead Dev",
          due: "Aug 28",
          tags: ["WebSocket", "Node.js"],
          createdById: user.id,
        },
        {
          projectId: p1.id,
          title: "Unit Tests for Path Planner",
          description: "Write comprehensive pytest suite for Dijkstra and A* path algorithms",
          status: "Backlog",
          priority: "Low",
          assigneeLabel: "QA Team",
          due: "Sep 05",
          tags: ["pytest", "Testing"],
          createdById: user.id,
        },
      ],
    })
  }
}

// ─── Project CRUD ─────────────────────────────────────────────────────────────

export async function getProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    await ensureDefaultProjectsAndTasks(user)
    const projects = await prisma.project.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
    })
    res.json(projects.map(serializeProject))
  } catch (err) { next(err) }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    const { name, description, color, teamId } = req.body

    if (!name || typeof name !== "string" || !name.trim()) {
      throw new ValidationError("Project name is required")
    }

    const project = await prisma.project.create({
      data: {
        organizationId: user.organizationId,
        teamId: teamId ?? user.teamId ?? null,
        name: name.trim(),
        description: description?.trim() ?? null,
        color: color ?? "#6366f1",
        createdById: user.id,
      },
    })
    res.status(201).json(serializeProject(project))
  } catch (err) { next(err) }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    const id = String(req.params.id)
    const { name, description, color } = req.body

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("Project not found")
    if (existing.organizationId !== user.organizationId) throw new ForbiddenError("Access denied")

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(name?.trim()               ? { name: name.trim() }                          : {}),
        ...(description !== undefined  ? { description: description?.trim() ?? null } : {}),
        ...(color                      ? { color }                                       : {}),
      },
    })
    res.json(serializeProject(updated))
  } catch (err) { next(err) }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    const id = String(req.params.id)

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("Project not found")
    if (existing.organizationId !== user.organizationId) throw new ForbiddenError("Access denied")

    await prisma.project.delete({ where: { id } })
    res.json({ message: "Project deleted" })
  } catch (err) { next(err) }
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export async function getAllTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    await ensureDefaultProjectsAndTasks(user)
    const tasks = await prisma.task.findMany({
      where: { project: { organizationId: user.organizationId } },
      include: {
        createdBy: { select: { id: true, name: true, initials: true } },
        assignee:  { select: { id: true, name: true, initials: true } },
      },
      orderBy: { createdAt: "asc" },
    })
    res.json(tasks.map(serializeTask))
  } catch (err) { next(err) }
}

export async function getTasksForProject(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    const projectId = String(req.params.id)

    const tasks = await prisma.task.findMany({
      where: { projectId, project: { organizationId: user.organizationId } },
      include: {
        createdBy: { select: { id: true, name: true, initials: true } },
        assignee:  { select: { id: true, name: true, initials: true } },
      },
      orderBy: { createdAt: "asc" },
    })
    res.json(tasks.map(serializeTask))
  } catch (err) { next(err) }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    let projectId = String(req.params.id)
    const { title, description, status, priority, assigneeId, assigneeLabel, due, tags } = req.body

    if (!title || typeof title !== "string" || !title.trim()) {
      throw new ValidationError("Task title is required")
    }

    // If projectId is not found or empty, find or create the default project
    let project = await prisma.project.findFirst({
      where: {
        organizationId: user.organizationId,
        ...(projectId && projectId !== "undefined" && projectId !== "all" ? { id: projectId } : {}),
      },
    })

    if (!project) {
      project = await prisma.project.create({
        data: {
          organizationId: user.organizationId,
          teamId: user.teamId,
          name: "Rover Control System",
          color: "#6366f1",
          createdById: user.id,
        },
      })
    }

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: title.trim(),
        description: description?.trim() ?? null,
        status: status ?? "To Do",
        priority: priority ?? "Medium",
        assigneeId: assigneeId ?? null,
        assigneeLabel: assigneeLabel?.trim() ?? user.name ?? "Member",
        due: due?.trim() ?? null,
        tags: Array.isArray(tags) ? tags : [],
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, initials: true } },
        assignee:  { select: { id: true, name: true, initials: true } },
      },
    })
    res.status(201).json(serializeTask(task))
  } catch (err) { next(err) }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    const taskId = String(req.params.taskId)
    const { title, description, status, priority, assigneeId, assigneeLabel, due, tags } = req.body

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
    })
    if (!existing) throw new NotFoundError("Task not found")

    const existingProject = await prisma.project.findUnique({ where: { id: existing.projectId } })
    if (!existingProject || existingProject.organizationId !== user.organizationId) throw new ForbiddenError("Access denied")

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title?.trim()                ? { title: title.trim() }                          : {}),
        ...(description !== undefined    ? { description: description?.trim() ?? null }    : {}),
        ...(status                       ? { status }                                       : {}),
        ...(priority                     ? { priority }                                     : {}),
        ...(assigneeId !== undefined     ? { assigneeId: assigneeId ?? null }              : {}),
        ...(assigneeLabel !== undefined  ? { assigneeLabel: assigneeLabel?.trim() ?? null } : {}),
        ...(due !== undefined            ? { due: due?.trim() ?? null }                    : {}),
        ...(tags !== undefined           ? { tags: Array.isArray(tags) ? tags : [] }       : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true, initials: true } },
        assignee:  { select: { id: true, name: true, initials: true } },
      },
    })
    res.json(serializeTask(updated))
  } catch (err) { next(err) }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    const taskId = String(req.params.taskId)

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
    })
    if (!existing) throw new NotFoundError("Task not found")

    const existingProject = await prisma.project.findUnique({ where: { id: existing.projectId } })
    if (!existingProject || existingProject.organizationId !== user.organizationId) throw new ForbiddenError("Access denied")

    await prisma.task.delete({ where: { id: taskId } })
    res.json({ message: "Task deleted" })
  } catch (err) { next(err) }
}
