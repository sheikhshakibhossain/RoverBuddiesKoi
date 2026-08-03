
# RoverBuddiesKoi

> **Know who's available before asking.**

RoverBuddiesKoi is an AI-powered team availability management platform built for engineering teams like **UIU Mars Rover Team (UMRT)**. It automatically imports members' university class schedules, calculates their real-time availability, and helps team leads quickly find the right people for meetings and tasks.

---

# Problem

Engineering teams often rely on group chats to ask:

* Who is free right now?
* Who can join a meeting?
* When is the best time for everyone?
* Which Software/Mechanical/Electrical members are available?

This process is slow, repetitive, and inefficient.

RoverBuddiesKoi solves this by automatically calculating every member's availability from their class routine.

---

# Goals

* Automatically import member class routines.
* Calculate real-time availability.
* Make finding available members effortless.
* Improve collaboration between teams and subteams.
* Reduce unnecessary communication.
* Provide a centralized member directory.

---

# Target Users

* UMRT Members
* Subteam Leads
* Team Leads
* Administrators

Although designed for UMRT, the platform can easily be adapted for any university club, research lab, or engineering organization.

---

# User Roles

## Super Admin

* Manage the platform
* Create teams and subteams
* Manage permissions
* Manage all users

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
* View team availability

---

# Core Features

## Team Management

* Teams
* Subteams
* Multiple subteam membership
* Multiple leads per subteam
* Role-based permissions

---

## Routine Upload

Supported formats

* UCAM XLSX
* PDF *(future support)*

The backend automatically extracts:

* Day
* Course
* Start Time
* End Time

and stores the weekly schedule in the database.

No manual data entry required.

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

## Search Members

Search members by:

* Day
* Time
* Team
* Subteam
* Role
* Availability

Example:

> Find Software members available on Wednesday at 4:00 PM.

---

## Member Profile

Each member profile includes:

* Basic information
* Team/Subteam(s)
* Weekly class schedule
* Today's schedule
* Current availability
* Next available time
* WhatsApp contact

---

## WhatsApp Integration

One-click messaging using WhatsApp.

---

## Availability Heatmap

Visualize member availability across the week using an interactive heatmap.

The system aggregates schedules and displays availability for the entire organization or selected teams/subteams, making it easy to identify the best time slots for meetings and collaboration.

### Views

* Overall Team Availability
* Team-wise Availability
* Subteam-wise Availability

### Filters

* Team
* Subteam
* Academic Batch
* Day
* Time Range

### Statistics Mode

Display exact availability counts.

Example:

| Time  |     Software |   Mechanical |  Electrical |
| ----- | -----------: | -----------: | ----------: |
| 10:00 | 18 / 22 Free |  9 / 14 Free | 6 / 10 Free |
| 11:00 | 21 / 22 Free | 13 / 14 Free | 9 / 10 Free |

Use cases:

* Find the best meeting time
* Compare availability across teams
* Identify peak collaboration hours
* Reduce scheduling conflicts

---

# Future Features

## AI Meeting Planner

Select:

* Teams/Subteams
* Required members
* Meeting duration

The system recommends the optimal meeting time.

---

## Skill-Based Search

Members can maintain skill tags such as:

* React
* Python
* ROS
* Embedded Systems
* CAD
* PCB
* Machine Learning
* UI/UX

Example:

> Find an available React developer.

---

## Notifications

* Missing routine reminders
* Semester update reminders
* Meeting notifications

---

## QR Meeting Attendance

Generate QR codes for meetings and automatically record attendance.

---

## AI Assistant

Natural language queries such as:

* Who is free after 3 PM today?
* Find two available Software members.
* When can Software and Mechanical meet together?

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
Dashboard & Search Engine
      │
      ▼
Leads Find Available Members
```

---

# Tech Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui

## Backend

* Next.js Server Actions / API Routes
* Prisma ORM
* PostgreSQL (Neon)

## Authentication

* Clerk or Auth.js

## File Parsing

* SheetJS (XLSX)
* PDF Parser *(future)*

## Deployment

* Vercel

---

# MVP Scope

* Authentication
* Team & Subteam Management
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

The platform should allow team leads to answer questions instantly, without asking in group chats.

Examples:

* Who is free right now?
* Who will be free next?
* Which Software members are available?
* Who is available tomorrow at 3 PM?
* When should we schedule a meeting?
* Which subteam has the highest availability this afternoon?

If these questions can be answered within seconds, RoverBuddiesKoi has achieved its goal.
