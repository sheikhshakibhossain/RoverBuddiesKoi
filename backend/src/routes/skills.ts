import { Router } from "express"
import { getSkillsCatalog, requestSkill, createSkill, getPendingSkills, approveSkill, rejectSkill } from "../controllers/skills.js"
import { authenticate } from "../middlewares/auth.js"
import { authorize } from "../middlewares/rbac.js"
import { Role } from "@prisma/client"

const router = Router()

router.get("/", authenticate, getSkillsCatalog)
router.post("/request", authenticate, requestSkill)
router.post("/create", authenticate, createSkill)
router.get("/pending", authenticate, authorize([Role.ORG_OWNER, Role.TEAM_MANAGER]), getPendingSkills)
router.put("/:id/approve", authenticate, authorize([Role.ORG_OWNER, Role.TEAM_MANAGER]), approveSkill)
router.put("/:id/reject", authenticate, authorize([Role.ORG_OWNER, Role.TEAM_MANAGER]), rejectSkill)

export default router
