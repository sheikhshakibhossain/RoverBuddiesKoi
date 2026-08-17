function resolveApiBaseUrl(): string {
  // In the browser, check if running on a remote host (e.g. *.vercel.app, mobile client, WAN domain)
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"

    // When deployed or accessed remotely (mobile network, cellular data, Vercel),
    // always use relative path "" so Vercel rewrites forward /api calls securely over HTTPS.
    if (!isLocalhost) {
      const explicit = import.meta.env.VITE_API_BASE_URL
      if (explicit && explicit.startsWith("https://") && !explicit.includes("localhost")) {
        return explicit.replace(/\/$/, "")
      }
      return ""
    }
  }

  // Local development fallback
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/$/, "")
  }

  // In dev, empty string lets Vite proxy forward /api to port 5000
  return ""
}

export const API_BASE_URL = resolveApiBaseUrl()

export function getAccessToken(): string | null {
  return localStorage.getItem("accessToken")
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken")
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken)
  localStorage.setItem("refreshToken", refreshToken)
}

export function clearTokens() {
  localStorage.removeItem("accessToken")
  localStorage.removeItem("refreshToken")
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const token = getAccessToken()

  const headers = new Headers(options.headers || {})
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  let res: Response
  try {
    res = await fetch(url, { ...options, headers })
  } catch (fetchErr: any) {
    // Graceful handling of network connection failure
    const msg = fetchErr?.message || ""
    if (msg.includes("fetch") || fetchErr.name === "TypeError") {
      throw new Error(
        `Unable to reach backend server at ${API_BASE_URL || window.location.origin}. Please ensure the backend is running.`
      )
    }
    throw fetchErr
  }

  // Token expired - attempt refresh once
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await attemptTokenRefresh()
    if (refreshed) {
      const newToken = getAccessToken()
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`)
        try {
          res = await fetch(url, { ...options, headers })
        } catch (fetchErr: any) {
          throw new Error("Unable to connect to the backend server. Please ensure the backend is running.")
        }
      }
    } else {
      clearTokens()
      window.location.reload()
      throw new Error("Session expired. Please log in again.")
    }
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`)
  }

  return data as T
}

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const rToken = getRefreshToken()
    if (!rToken) return false

    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rToken }),
    })

    if (!res.ok) return false
    const data = await res.json()
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken)
      return true
    }
    return false
  } catch {
    return false
  }
}

// ─── API Domain Clients ───────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const data = await fetchApi<{ user: any; accessToken: string; refreshToken: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    )
    setTokens(data.accessToken, data.refreshToken)
    return data.user
  },

  register: async (formData: FormData) => {
    const data = await fetchApi<{ user: any; accessToken: string; refreshToken: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: formData,
      }
    )
    setTokens(data.accessToken, data.refreshToken)
    return data.user
  },

  getMe: async () => {
    return fetchApi<any>("/api/auth/me")
  },

  logout: async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      await fetchApi("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ token: refreshToken }),
      }).catch(() => {})
    }
    clearTokens()
  },

  deleteAccount: async () => {
    await fetchApi("/api/auth/me", { method: "DELETE" })
    clearTokens()
  }
}

export const membersApi = {
  getMembers: async (filters: Record<string, string> = {}) => {
    const query = new URLSearchParams(filters).toString()
    return fetchApi<any[]>(`/api/members?${query}`)
  },

  getMemberById: async (id: string) => {
    return fetchApi<any>(`/api/members/${id}`)
  },

  getPendingRoles: async () => {
    return fetchApi<any[]>("/api/members/pending-roles")
  },

  updateRole: async (id: string, action: "approve" | "reject") => {
    return fetchApi(`/api/members/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ action })
    })
  },
}

export const teamsApi = {
  // Returns teams with subteams for this user's scope
  getTeams: async () => {
    return fetchApi<any[]>("/api/teams")
  },
  // Returns {batches: string[], skills: {id,name,category}[]}
  getOrgMeta: async () => {
    return fetchApi<{ batches: string[]; skills: { id: string; name: string; category: string }[] }>(
      "/api/teams/meta"
    )
  },
}

export const routinesApi = {
  uploadRoutine: async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return fetchApi<any>("/api/routines/upload", {
      method: "POST",
      body: formData,
    })
  },
}

export const skillsApi = {
  getSkillsCatalog: async () => {
    return fetchApi<{ catalog: any[]; mySkills: any[] }>("/api/skills")
  },

  requestSkill: async (skillName: string) => {
    return fetchApi("/api/skills/request", {
      method: "POST",
      body: JSON.stringify({ skillName }),
    })
  },

  getPendingSkills: async () => {
    return fetchApi<any[]>("/api/skills/pending")
  },

  approveSkill: async (id: string) => {
    return fetchApi(`/api/skills/${id}/approve`, { method: "PUT" })
  },

  rejectSkill: async (id: string) => {
    return fetchApi(`/api/skills/${id}/reject`, { method: "PUT" })
  },
}

export const heatmapApi = {
  // Live computed heatmap
  getHeatmap: async (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchApi<any>(`/api/heatmap?${query}`)
  },
  // Historical snapshots (last 14)
  getSnapshots: async () => {
    return fetchApi<any[]>("/api/heatmap/snapshots")
  },
  // Manually trigger a snapshot (Org Owner only)
  computeSnapshot: async () => {
    return fetchApi<any>("/api/heatmap/compute", { method: "POST" })
  },
}

export const aiApi = {
  sendChatMessage: async (message: string) => {
    return fetchApi<{ reply: string }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    })
  },
}

// ─── Projects & Tasks API ─────────────────────────────────────────────────────

export const projectsApi = {
  // ── Projects ──────────────────────────────────────────────────────────────
  getProjects: () =>
    fetchApi<any[]>("/api/projects"),

  createProject: (data: { name: string; description?: string; color?: string; teamId?: string }) =>
    fetchApi<any>("/api/projects", { method: "POST", body: JSON.stringify(data) }),

  updateProject: (id: string, data: { name?: string; description?: string; color?: string }) =>
    fetchApi<any>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteProject: (id: string) =>
    fetchApi<any>(`/api/projects/${id}`, { method: "DELETE" }),

  // ── Tasks ──────────────────────────────────────────────────────────────────
  getAllTasks: () =>
    fetchApi<any[]>("/api/projects/tasks/all"),

  getProjectTasks: (projectId: string) =>
    fetchApi<any[]>(`/api/projects/${projectId}/tasks`),

  createTask: (
    projectId: string,
    data: {
      title: string; description?: string; status?: string; priority?: string
      assigneeId?: string | null; assigneeLabel?: string; due?: string; tags?: string[]
    }
  ) =>
    fetchApi<any>(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTask: (
    taskId: string,
    data: {
      title?: string; description?: string; status?: string; priority?: string
      assigneeId?: string | null; assigneeLabel?: string; due?: string; tags?: string[]
    }
  ) =>
    fetchApi<any>(`/api/projects/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTask: (taskId: string) =>
    fetchApi<any>(`/api/projects/tasks/${taskId}`, { method: "DELETE" }),
}

