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

RoverBuddiesKoi solves this by automatically calculating every member's availability from their class routine and providing powerful search and visualization tools.

---

# Goals

* Automatically import member class routines.
* Calculate real-time availability.
* Make finding available members effortless.
* Improve collaboration between teams and subteams.
* Reduce unnecessary communication.
* Provide a centralized member directory.
* Help organizations schedule meetings efficiently.

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

# User Roles

## Organization Admin

* Manage the organization
* Create and manage teams
* Assign Team Admins
* Manage organization members
* View organization-wide analytics

---

## Team Admin

* Manage a team
* Create and manage subteams
* Assign Subteam Leads
* Manage team members
* View team availability

---

## Subteam Lead

* Manage assigned subteams
* Add or remove members
* View member schedules
* Search member availability

> Multiple leads can exist within the same subteam.

---

## Member

* Update profile
* Upload class routine
* View schedules
* View availability

---

# Core Features

## Organization Management

Features include:

* Multiple Organizations
* Multiple Teams
* Multiple Subteams
* Multiple Team Admins
* Multiple Subteam Leads
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

The parsed schedule is stored in the database automatically.

No manual data entry is required.

---

## Real-Time Availability

Automatically determines whether a member is:

* 🟢 Free
* 🔴 In Class
* 🟡 Class Starting Soon
* ⚪ No Routine Uploaded

Dashboard displays:

* Members currently free
* Members currently busy
* Members becoming free next
* Remaining class duration

---

## Member Search

Search members using filters such as:

* Organization
* Team
* Subteam
* Day
* Time
* Role
* Availability

Example:

> Find Software members available on Wednesday at 4:00 PM.

---

## Member Profile

Each member profile includes:

* Basic Information
* Organization
* Team
* Subteam(s)
* Weekly Class Schedule
* Today's Schedule
* Current Availability
* Next Available Time
* WhatsApp Contact

---

## WhatsApp Integration

One-click messaging using WhatsApp.

---

## Availability Heatmap

Visualize availability across the week using interactive heatmaps.

The system aggregates schedules and displays availability at multiple organizational levels.

### Views

* Organization-wide Availability
* Team-wise Availability
* Subteam-wise Availability

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

| Time  |         UMRT |      AI Team |  Drone Team |
| ----- | -----------: | -----------: | ----------: |
| 10:00 | 18 / 22 Free |  9 / 14 Free | 6 / 10 Free |
| 11:00 | 21 / 22 Free | 13 / 14 Free | 9 / 10 Free |

Or drill down into a specific team.

| Time  |     Software |   Mechanical |  Electrical |
| ----- | -----------: | -----------: | ----------: |
| 10:00 | 18 / 22 Free |  9 / 14 Free | 6 / 10 Free |
| 11:00 | 21 / 22 Free | 13 / 14 Free | 9 / 10 Free |

### Use Cases

* Find the best meeting time
* Compare team availability
* Compare subteam availability
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

## Skill-Based Search

Members can maintain skill tags.

Examples:

* React
* Python
* ROS
* Embedded Systems
* CAD
* PCB
* Machine Learning
* UI/UX

Example query:

> Find an available React developer.

---

## Notifications

* Missing routine reminders
* Semester update reminders
* Meeting reminders
* Upcoming availability alerts

---

## QR Meeting Attendance

Generate QR codes for meetings and automatically record attendance.

---

## AI Assistant

Natural language queries such as:

* Who is free after 3 PM today?
* Find two available Software members.
* Which Mechanical members are free tomorrow?
* When can Software and Mechanical meet together?
* Which team has the highest availability this afternoon?

---

# Workflow

```text
Member Login
      │
      ▼
Upload UCAM Routine
      │
      ▼
Backend Parses XLSX
      │
      ▼
Store Weekly Schedule
      │
      ▼
Generate Availability Timeline
      │
      ▼
Availability Engine
      │
      ▼
Dashboard
Search
Heatmaps
Profiles
Meeting Planner
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
* Role-Based Access Control
* Member Profiles
* Routine Upload (XLSX)
* Automatic Routine Parsing
* Schedule Storage
* Real-Time Availability Calculation
* Dashboard
* Member Search
* Availability Heatmap
* WhatsApp Integration
* Admin Dashboard

---

# Success Criteria

The platform should enable leaders to answer questions instantly without asking in group chats.

Examples:

* Who is free right now?
* Who will be free next?
* Which Software members are available?
* Who is available tomorrow at 3 PM?
* Which team has the highest availability?
* Which subteam is mostly free this afternoon?
* When is the best time to schedule a meeting?

If these questions can be answered within seconds, RoverBuddiesKoi has achieved its goal.
