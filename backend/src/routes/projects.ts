import { Router } from "express"
import { authenticate } from "../middlewares/auth.js"
import { authorize } from "../middlewares/rbac.js"
import { Role } from "@prisma/client"
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getAllTasks,
  getTasksForProject,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/projects.js"

const router = Router()

const MANAGERS = [Role.ORG_OWNER, Role.TEAM_MANAGER]

// ─── Project routes ───────────────────────────────────────────────────────────

// All authenticated users can view projects
router.get("/",    authenticate, getProjects)
// Only managers can create, edit, delete projects
router.post("/",   authenticate, authorize(MANAGERS), createProject)
router.put("/:id", authenticate, authorize(MANAGERS), updateProject)
router.delete("/:id", authenticate, authorize(MANAGERS), deleteProject)

// ─── Task routes ──────────────────────────────────────────────────────────────

// Fetch tasks visible to the user across projects
router.get("/tasks/all", authenticate, getAllTasks)

// Per-project task list
router.get("/:id/tasks",  authenticate, getTasksForProject)
router.post("/:id/tasks", authenticate, createTask)

// Update / delete a specific task
router.put("/tasks/:taskId",    authenticate, updateTask)
router.delete("/tasks/:taskId", authenticate, deleteTask)

export default router
