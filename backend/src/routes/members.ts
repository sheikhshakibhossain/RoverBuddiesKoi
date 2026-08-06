import { Router } from "express"
import { getMembers, getMemberById, getPendingRoles, updateRole } from "../controllers/members.js"
import { authenticate } from "../middlewares/auth.js"
import { authorize } from "../middlewares/rbac.js"
import { Role } from "@prisma/client"

const router = Router()

router.get("/", authenticate, getMembers)
router.get("/pending-roles", authenticate, authorize([Role.ORG_OWNER, Role.TEAM_MANAGER]), getPendingRoles)
router.get("/:id", authenticate, getMemberById)
router.put("/:id/role", authenticate, authorize([Role.ORG_OWNER, Role.TEAM_MANAGER]), updateRole)

export default router
