# RoverBuddiesKoi

> **Know who's available before asking.**

RoverBuddiesKoi is an AI-powered availability management platform designed for organizations with multiple teams and subteams, such as research labs, robotics teams, and engineering clubs. It automatically imports members' university class schedules, calculates real-time availability, and helps leaders quickly find the right people for meetings, collaboration, and project work.

---

# Problem

Engineering organizations often rely on group chats to ask:

* Who is free right now?
* Who can join a meeting?
* When is the best time for everyone?
* Which Software/Mechanical/Electrical members are available?

This process is repetitive, time-consuming, and inefficient.

RoverBuddiesKoi solves this by automatically calculating every member's availability from their class routine and providing powerful search, visualization, and scheduling tools.

---

# Goals

* Automatically import member class routines.
* Calculate real-time availability.
* Make finding available members effortless.
* Improve collaboration between teams and subteams.
* Reduce unnecessary communication.
* Provide a centralized member directory.
* Help organizations schedule meetings efficiently.
* Enforce semester-based routine submission for accurate availability.

---

# Target Users

The platform is designed for organizations consisting of multiple teams and subteams.

Examples include:

* Research Labs
* Robotics Teams
* University Clubs
* Engineering Organizations
* Startup Teams

Example hierarchy:

```text
Organization
└── CAIR Lab
    ├── UMRT
    ├── URRT
    └── Team XYZ
```

Although initially developed for **CAIR Lab**, the platform is designed to support any organization with a similar structure.

---

# Organization Structure

```text
Organization
│
├── Team
│   ├── Subteam
│   │   └── Members
│   └── Subteam
│
├── Team
│   ├── Subteam
│   └── Subteam
│
└── Team
    ├── Subteam
    └── Subteam
```

A member may belong to multiple subteams within the same team.

---

# Access Control

The platform uses **Role-Based Access Control (RBAC)**.

## Organization Owner

Highest privilege.

Permissions:

* Manage the organization
* Manage all teams
* Manage all subteams
* Manage all users
* Assign and revoke roles
* Configure semesters/trimesters
* Approve skills globally
* View organization-wide analytics

---

## Team Manager

Permissions:

* Manage assigned team
* Create and manage subteams
* Assign Subteam Managers
* Manage team members
* Approve member skills
* View team analytics

Cannot access other teams.

---

## Subteam Manager

Permissions:

* Manage assigned subteam
* Add or remove members
* Approve member skills
* View subteam schedules
* View subteam analytics

Cannot manage other subteams.

---

## Member

Permissions:

* Upload class routine
* Update profile
* Request new skills
* View availability
* Search members within assigned subteam(s)
* Contact teammates

Members **cannot view other teams or subteams** unless explicitly granted permission.

---

# Semester Management

Each organization defines its academic calendar.

For every semester or trimester, an Organization Owner configures:

* Semester Name
* Start Date
* End Date
* Routine Upload Deadline

Example:

```text
Fall 2026

Start:
1 September

End:
31 December

Routine Upload Deadline:
10 September
```

After the upload deadline:

* Members who uploaded a valid routine continue using the platform normally.
* Members without a valid routine are restricted until they upload their latest class routine.

This ensures availability information always reflects the current academic schedule.

---

# Core Features

## Organization Management

Features include:

* Multiple Organizations
* Multiple Teams
* Multiple Subteams
* Multiple Team Managers
* Multiple Subteam Managers
* Multiple Subteam Membership
* Role-Based Access Control (RBAC)

---

## Routine Upload

Supported formats:

* UCAM XLSX
* PDF *(future support)*

The backend automatically extracts:

* Course
* Day
* Start Time
* End Time

The parsed schedule is stored automatically.

No manual data entry is required.

---

## Real-Time Availability

Automatically determines whether a member is:

* 🟢 Free
* 🔴 In Class
* 🟡 Class Starting Soon
* ⚪ Routine Missing / Expired

Dashboard displays:

* Members currently free
* Members currently busy
* Members becoming free next
* Remaining class duration

---

## Member Search

Search members using filters:

* Organization
* Team
* Subteam
* Day
* Time
* Availability
* Skill

Results are restricted according to user permissions.

Example:

> Find available Software members on Wednesday at 4:00 PM.

---

## Member Profile

Each profile contains:

* Basic Information
* Organization
* Team
* Subteam(s)
* Weekly Schedule
* Today's Schedule
* Current Availability
* Next Available Time
* Approved Skills
* WhatsApp Contact

Visibility depends on the user's role and permissions.

---

## Skill Management

Members can select skills from a predefined catalog.

Examples:

* React
* TypeScript
* Python
* ROS
* Embedded Systems
* PCB Design
* CAD
* Machine Learning
* UI/UX
* DevOps

### Skill Approval Workflow

```text
Member
    │
    ▼
Select Skill
    │
    ▼
Pending Approval
    │
    ▼
Team Manager / Subteam Manager
    │
Approve / Reject
    │
    ▼
Approved Skill Appears on Profile
```

Only approved skills become searchable.

---

## WhatsApp Integration

One-click messaging using WhatsApp.

---

## Availability Heatmap

Visualize availability across the week using interactive heatmaps.

Availability can be viewed at multiple levels.

### Views

* Organization
* Team
* Subteam

### Filters

* Organization
* Team
* Subteam
* Academic Batch
* Day
* Time Range

### Statistics Mode

Display exact availability counts.

Example:

| Time  |         UMRT |         URRT |   Team XYZ |
| ----- | -----------: | -----------: | ---------: |
| 10:00 | 18 / 22 Free |  9 / 12 Free | 6 / 9 Free |
| 11:00 | 21 / 22 Free | 10 / 12 Free | 8 / 9 Free |

Or drill into a specific team.

| Time  |     Software |   Mechanical |  Electrical |
| ----- | -----------: | -----------: | ----------: |
| 10:00 | 18 / 22 Free |  9 / 14 Free | 6 / 10 Free |
| 11:00 | 21 / 22 Free | 13 / 14 Free | 9 / 10 Free |

### Use Cases

* Find the best meeting time
* Compare teams
* Compare subteams
* Identify peak collaboration hours
* Reduce scheduling conflicts

---

# Future Features

## AI Meeting Planner

Select:

* Organization
* Team(s)
* Subteam(s)
* Required Members
* Meeting Duration

The system recommends the optimal meeting time.

---

## AI Assistant

Natural language queries such as:

* Who is free after 3 PM today?
* Find two available Software members.
* Which Mechanical members are free tomorrow?
* When can Software and Mechanical meet together?
* Which team has the highest availability this afternoon?

---

## Notifications

* Missing routine reminders
* Semester reminders
* Routine expiration reminders
* Meeting reminders
* Upcoming availability alerts

---

## QR Meeting Attendance

Generate QR codes for meetings and automatically record attendance.

---

## Calendar Integration

Sync meetings with Google Calendar and Outlook.

---

# Workflow

```text
Member Login
      │
      ▼
Role & Permission Validation
      │
      ▼
Semester Validation
      │
      ▼
Routine Uploaded?
      │
 ┌────┴─────┐
 │          │
Yes        No
 │          │
 ▼          ▼
Dashboard  Upload Routine
 │
 ▼
Availability Engine
 │
 ├── Dashboard
 ├── Member Search
 ├── Heatmaps
 ├── Member Profiles
 └── AI Meeting Planner
```

---

# Tech Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* React Router

---

## Backend

* Node.js
* Vercel Serverless Functions
* Prisma ORM

---

## Database

* PostgreSQL (Neon Free Tier)

---

## Authentication

* JWT
* bcrypt

---

## File Processing

* SheetJS (`xlsx`)
* `pdf-parse` *(future support)*

---

## Development

* Git
* GitHub
* ESLint
* Prettier
* Postman

---

## Deployment

* Vercel
* Neon PostgreSQL

---

# MVP Scope

* Authentication
* Organization Management
* Team Management
* Subteam Management
* Role-Based Access Control (RBAC)
* Semester Management
* Member Profiles
* Routine Upload (XLSX)
* Automatic Routine Parsing
* Schedule Storage
* Real-Time Availability Calculation
* Member Search
* Availability Heatmaps
* Skill Approval Workflow
* WhatsApp Integration
* Organization Dashboard
* Team Dashboard

---

# Success Criteria

The platform should enable leaders to answer operational questions instantly without asking in group chats.

Examples:

* Who is free right now?
* Who will be free next?
* Which Software members are available?
* Who is available tomorrow at 3 PM?
* Which team has the highest availability?
* Which subteam is mostly free this afternoon?
* Which members have approved React skills and are currently free?
* When is the best time to schedule a meeting?

If these questions can be answered within seconds while maintaining accurate schedules, proper access control, and up-to-date member information, RoverBuddiesKoi has achieved its goal.
