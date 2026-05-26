
# CLAUDE.md — VolunTutor (Online Classroom Platform)


## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.



## Project Overview

VolunTutor is a web-based platform that connects teachers and students in an organized online learning environment, inspired by Google Classroom. It supports class creation, assignment management, real-time chat, live video classes, and structured course content delivery.

All four of the following are **Phase 1 priorities** and must be built concurrently:
1. **Chat / Messaging** — real-time private and class-level messaging
2. **Course Content & Materials** — organized resource library per class
3. **Assignments & Grading** — full submission and feedback workflow
4. **Live Video Classes** — scheduled sessions with recording support

---

## Recommended Tech Stack

No stack has been decided yet. The following is the recommended combination based on the feature set — especially the need for real-time messaging and live video:

| Layer          | Recommendation              | Reason                                                      |
|----------------|-----------------------------|-------------------------------------------------------------|
| Frontend       | **Next.js 14 (App Router)** | SSR for fast page loads, file-based routing, great DX       |
| Styling        | **Tailwind CSS**            | Rapid UI development, consistent design tokens              |
| Backend        | **Node.js + Express**       | Same language as frontend, huge ecosystem, easy WebSocket   |
| Real-time      | **Socket.io**               | Handles chat, live notifications, presence indicators       |
| Database       | **PostgreSQL**              | Relational data (enrollments, grades, submissions) + JSONB  |
| ORM            | **Prisma**                  | Type-safe queries, auto-migration, great DX                 |
| File Storage   | **Supabase Storage**        | Simple setup, generous free tier, S3-compatible API         |
| Video          | **Daily.co**                | Easiest embed SDK, recordings built-in, free dev tier       |
| Auth           | **JWT + bcrypt**            | Full control; add NextAuth.js if Google OAuth is needed     |
| Cache / Queue  | **Redis (Upstash)**         | Session store, Socket.io adapter for scaling, job queues    |
| Deployment     | **Vercel (FE) + Railway (BE)** | Zero-config deploys, free tiers for early development    |

> If the team prefers Python, swap Node.js/Express for **Django + Django Channels** (WebSocket support built in) with **psycopg2** for PostgreSQL.

---

## Architecture

### High-Level Structure

```
VolunTutor/
├── frontend/                    # Next.js 14 App Router
│   ├── app/                     # Route segments (pages)
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # Primitives (Button, Modal, Badge)
│   │   ├── classroom/           # Class-specific components
│   │   ├── assignments/         # Assignment + grading components
│   │   ├── chat/                # Messaging components
│   │   └── video/               # Live class components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # API client, socket client, utils
│   ├── context/                 # Auth context, socket context
│   └── types/                   # Shared TypeScript types
├── backend/                     # Node.js + Express
│   ├── routes/                  # REST API route definitions
│   ├── controllers/             # Request/response handlers
│   ├── services/                # Business logic
│   ├── middleware/              # Auth, validation, error handling
│   ├── sockets/                 # Socket.io event handlers
│   │   ├── chat.socket.ts       # Real-time messaging events
│   │   ├── notification.socket.ts
│   │   └── video.socket.ts      # Session join/leave signaling
│   └── lib/                     # Prisma client, Redis, storage
├── prisma/                      # Prisma schema + migrations
├── uploads/                     # Local dev file storage only
└── CLAUDE.md
```

### User Roles

| Role    | Capabilities                                                         |
|---------|----------------------------------------------------------------------|
| Teacher | Create/manage classes, post assignments, grade submissions, message students |
| Student | Join classes via code, submit assignments, view grades, message teachers |
| Admin   | Manage all users and classes across the platform (optional scope)    |

---

## Core Features

### 1. Authentication & Authorization
- Email/password registration with role selection (Teacher / Student)
- JWT-based auth with refresh token rotation
- Google OAuth as an optional login provider
- Protected routes enforced both client-side and server-side
- Role-based access control (RBAC) on all API endpoints

### 2. Classroom Management
- Teachers create classrooms with a unique join code (e.g., `ABC123`)
- Students join by entering the code; teacher can approve or auto-accept
- Class has: name, subject, section, description, banner color/image
- Teacher can remove students or archive/delete a class
- Each class has three tabs: **Stream**, **Classwork**, **People**

### 3. Stream (Class Feed)
- Announcements posted by teachers
- Students can comment on announcements
- Assignment and quiz posts automatically appear in Stream
- Pinned announcements stay at the top
- Timestamps and edit history on posts

### 4. Classwork (Assignments & Quizzes)
- Teachers create assignments with:
  - Title, description, due date/time
  - Point value (or "ungraded")
  - File attachments (PDFs, images, docs)
  - Topic/category label
- Assignment types: Short answer, file upload, multiple choice quiz
- Students submit work before due date; late submission flagged
- Teacher grades each submission and leaves feedback
- Grades are visible to each individual student

### 5. Grading
- Teachers view all submissions in a grading view
- Assign a numeric or letter grade per submission
- Leave written feedback per submission
- Bulk return grades to students
- Grade summary visible per assignment (average, highest, lowest)

### 6. Messaging / Communication ⭐ Phase 1 Priority
- **Real-time private messaging** between teacher ↔ student via Socket.io
- **Class-level group chat** — all class members share a live channel per classroom
- Typing indicators (`user is typing...`) and read receipts per message
- Message history persisted in DB; paginated on scroll (cursor-based)
- File/image sharing in chat (reuses the same upload pipeline as assignments)
- Email notifications for new messages (debounced — max 1 email per 5 min per thread)
- In-app notification bell with unread count badge per conversation
- Socket.io rooms: one room per `classroomId` for group chat, one room per sorted `userId` pair for DMs
- Online presence: show green dot if user is currently connected

### 7. Course Materials ⭐ Phase 1 Priority
- Teachers upload materials (distinct from assignments) to a "Resources" section
- Organized by topic/unit with drag-and-drop reordering
- Supported content types: PDF, images, video links (YouTube/Vimeo embed), external URLs, Google Drive links
- Materials can be scheduled to publish at a future date/time
- Students can view but not edit; can bookmark materials
- Material view count tracked per student (teacher can see who has viewed)

### 8. Live Classes ⭐ Phase 1 Priority
- Integrate with **Daily.co** SDK (recommended) or Agora/Jitsi as alternatives
- Teacher schedules a live session: title, date/time, estimated duration
- Students receive in-app notification + email reminder 15 minutes before start
- One-click join from class Stream or dashboard upcoming sessions widget
- In-session features: camera/mic toggle, screen share, raise hand queue, in-session chat sidebar
- Teacher can mute all, mute individual, or remove a participant
- Session auto-records; recording URL stored and linked in class Stream after it ends
- Session status lifecycle: `scheduled → live → ended`
- `LiveSession` model tracks: participants list, actual start/end times, recording URL, Daily.co room name

---

## Data Models

### User
```
id, email, passwordHash, role (teacher|student), name,
avatarUrl, isOnline, lastSeenAt, createdAt, updatedAt
```

### Classroom
```
id, name, subject, section, description, bannerColor,
joinCode (unique, 6-char), teacherId (FK), archivedAt, createdAt
```

### Enrollment
```
id, classroomId (FK), studentId (FK), joinedAt, status (active|removed)
```

### Post (Stream)
```
id, classroomId (FK), authorId (FK), type (announcement|assignment|material|session),
content, attachments[], isPinned, scheduledAt, createdAt, updatedAt
```

### Assignment
```
id, postId (FK), title, description, dueAt, points,
assignmentType (upload|text|quiz), topicId (FK)
```

### Submission
```
id, assignmentId (FK), studentId (FK), content, attachments[],
submittedAt, isLate, grade, feedback, gradedAt, returnedAt
```

### Material
```
id, classroomId (FK), title, description, type (pdf|image|video|link|drive),
url, topicId (FK), publishAt, viewCount, createdAt
```

### Message
```
id, senderId (FK), receiverId (FK, null for group), classroomId (FK, null for DM),
body, attachments[], readAt, createdAt
```

### LiveSession
```
id, classroomId (FK), title, scheduledAt, estimatedDuration,
dailyRoomName, dailyRoomUrl, status (scheduled|live|ended),
startedAt, endedAt, recordingUrl, createdAt
```

### SessionParticipant
```
id, sessionId (FK), userId (FK), joinedAt, leftAt
```

### Notification
```
id, userId (FK), type (message|grade|assignment|session|material),
referenceId, message, readAt, createdAt
```

---

## API Design

All endpoints are prefixed with `/api/v1`.

### Auth
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me
```

### Classrooms
```
GET    /classrooms                    # List classes for current user
POST   /classrooms                    # Teacher: create class
GET    /classrooms/:id                # Get class details
PATCH  /classrooms/:id                # Teacher: update class
DELETE /classrooms/:id                # Teacher: delete/archive class
POST   /classrooms/join               # Student: join with code
GET    /classrooms/:id/people         # List teacher + enrolled students
DELETE /classrooms/:id/students/:uid  # Teacher: remove student
```

### Stream & Posts
```
GET    /classrooms/:id/posts          # Get stream posts
POST   /classrooms/:id/posts          # Teacher: create post/announcement
PATCH  /posts/:id                     # Author: edit post
DELETE /posts/:id                     # Author: delete post
POST   /posts/:id/comments            # Add comment
DELETE /comments/:id                  # Delete comment
```

### Assignments
```
GET    /classrooms/:id/assignments    # List assignments
POST   /classrooms/:id/assignments    # Teacher: create assignment
GET    /assignments/:id               # Get single assignment
PATCH  /assignments/:id               # Teacher: edit assignment
DELETE /assignments/:id               # Teacher: delete assignment
```

### Submissions
```
POST   /assignments/:id/submit        # Student: submit work
GET    /assignments/:id/submissions   # Teacher: view all submissions
GET    /assignments/:id/my-submission # Student: view own submission
PATCH  /submissions/:id/grade         # Teacher: grade + feedback
PATCH  /submissions/:id/return        # Teacher: return to student
```

### Messages (REST — history & threads)
```
GET    /messages                        # Get all conversation threads
GET    /messages/dm/:userId             # Get DM thread with a user (paginated)
GET    /messages/class/:classroomId     # Get class group chat history (paginated)
DELETE /messages/:id                    # Delete own message
```

### Socket.io Events (Real-time Messaging)
```
# Client → Server
chat:send          { threadId, body, attachments[] }
chat:typing        { threadId }
chat:read          { messageId }

# Server → Client
chat:message       { message object }
chat:typing        { userId, threadId }
chat:read_receipt  { messageId, readBy }
user:online        { userId }
user:offline       { userId }
```

### Materials
```
GET    /classrooms/:id/materials        # List materials (optionally by topic)
POST   /classrooms/:id/materials        # Teacher: upload/add material
PATCH  /materials/:id                   # Teacher: edit material
DELETE /materials/:id                   # Teacher: delete material
GET    /materials/:id/views             # Teacher: see who has viewed
POST   /materials/:id/view              # Student: mark as viewed
```

### Live Sessions
```
GET    /classrooms/:id/sessions         # List sessions (upcoming + past)
POST   /classrooms/:id/sessions         # Teacher: schedule a session
GET    /sessions/:id                    # Get session details + join URL
PATCH  /sessions/:id                    # Teacher: edit session
DELETE /sessions/:id                    # Teacher: cancel session
POST   /sessions/:id/start              # Teacher: start session (create Daily.co room)
POST   /sessions/:id/end                # Teacher: end session
GET    /sessions/:id/participants       # Get participant list
```

### Notifications
```
GET    /notifications                   # Get notifications (paginated)
PATCH  /notifications/:id/read          # Mark one as read
PATCH  /notifications/read-all          # Mark all as read
```

---

## Frontend Pages

| Route                                    | View                                      |
|------------------------------------------|-------------------------------------------|
| `/`                                      | Landing / marketing page                  |
| `/login` `/register`                     | Auth pages                                |
| `/dashboard`                             | All classes + upcoming sessions overview  |
| `/classes/:id`                           | Class Stream tab                          |
| `/classes/:id/classwork`                 | Assignments list                          |
| `/classes/:id/materials`                 | Course materials / resources              |
| `/classes/:id/sessions`                  | Live sessions (upcoming + recordings)     |
| `/classes/:id/chat`                      | Class group chat                          |
| `/classes/:id/people`                    | Enrolled users                            |
| `/classes/:id/assignments/:aid`          | Assignment detail / submission            |
| `/sessions/:id/live`                     | Active video session (Daily.co embed)     |
| `/grades`                                | Student: all grades overview              |
| `/messages`                              | Inbox — DMs and class chats               |
| `/settings`                              | Profile and notification preferences      |

---

## Real-time Architecture

Socket.io runs on the same Express server. On connection, the server:
1. Authenticates the socket using the JWT passed in `auth.token`
2. Joins the user to their personal room: `user:<userId>`
3. Joins the user to rooms for each enrolled/teaching classroom: `class:<classroomId>`

This means class-level events (new message, session starting) are broadcast to `class:<classroomId>`, and personal events (grade returned, DM received) are sent to `user:<userId>`.

Redis (via `@socket.io/redis-adapter`) is used to sync socket state across multiple backend instances in production.

---

## File Uploads

- Use **multipart/form-data** for file uploads
- Store files in **Supabase Storage** (recommended) or AWS S3 in production
- Local `/uploads` directory for development only
- Allowed MIME types: `application/pdf`, `image/*`, `video/*`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`
- Max file size: 50MB per file, 200MB total per submission
- Generate pre-signed/signed URLs for time-limited secure file access

---

## Environment Variables

```env
# App
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Database (PostgreSQL via Prisma)
DATABASE_URL=postgresql://user:password@localhost:5432/VolunTutor

# Auth
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# File Storage — Supabase Storage (recommended)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=VolunTutor-files

# Email (notifications via SMTP or Resend)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=no-reply@VolunTutor.app
# Alternative: RESEND_API_KEY=

# Real-time — Redis for Socket.io adapter
REDIS_URL=redis://localhost:6379

# Live Video — Daily.co
DAILY_API_KEY=
DAILY_DOMAIN=your-domain.daily.co
```

---

## Code Conventions

### General
- Use `camelCase` for variables and functions
- Use `PascalCase` for components and classes
- Use `SCREAMING_SNAKE_CASE` for constants
- Prefer `async/await` over raw promise chains
- All API responses follow: `{ success: boolean, data: any, message?: string }`

### Frontend
- One component per file; filename matches component name
- Co-locate styles with components (`Component.module.css` or Tailwind)
- All API calls go through `services/` — no raw `fetch` in components
- Use React Context for auth state; use React Query or SWR for server state
- Validate forms with `react-hook-form` + `zod`

### Backend
- Controllers only handle request/response — business logic lives in services
- Always validate and sanitize incoming request bodies (use `zod` or `joi`)
- Wrap async route handlers in a `catchAsync` utility
- HTTP errors use consistent status codes (401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity)
- Never expose password hashes, internal IDs mapping, or raw DB errors to the client

---

## Security Checklist

- [ ] Hash passwords with bcrypt (salt rounds ≥ 12)
- [ ] Validate JWT on every protected route
- [ ] Ensure students can only access classes they're enrolled in
- [ ] Ensure teachers can only modify their own classes
- [ ] Sanitize file uploads (validate MIME type server-side, not just extension)
- [ ] Rate-limit auth endpoints (e.g., 5 login attempts per minute)
- [ ] CORS restricted to known origins in production
- [ ] All secrets in environment variables — nothing hardcoded

---

## Testing Strategy

- **Unit tests**: service layer functions (grading logic, join code generation)
- **Integration tests**: API routes with a test database
- **E2E tests**: critical flows — register, create class, post assignment, submit, grade
- Test files live alongside source: `*.test.ts` or in `__tests__/`
- Run tests with: `npm test` or `pytest`

---

## Common Tasks for Claude

When working on this codebase, here are typical tasks and where to focus:

- **Adding a new REST endpoint**: Add route → controller → service → Prisma query
- **New Socket.io event**: Add handler in `sockets/chat.socket.ts` (or relevant file), emit from service layer after DB write
- **New UI page**: Create route segment in `app/`, build page component, wire up API/socket calls
- **Database schema change**: Edit `prisma/schema.prisma` → run `npx prisma migrate dev` → update affected services
- **New notification type**: Add to `NotificationType` enum in Prisma schema, trigger emit in the relevant service, handle in `notification.socket.ts`, add frontend toast/bell handler
- **Debugging a chat bug**: Check Socket.io room membership on connect, verify `threadId` construction, check Redis adapter connection
- **Debugging a submission bug**: Check `submissions` controller, `assignmentId` FK integrity, student enrollment status
- **Adding a Daily.co session**: Create room via Daily.co API in `sessions.service.ts`, store `roomName` and `roomUrl` in `LiveSession`, emit `session:starting` socket event 5 min before scheduled time

---

## Out of Scope (for now)

- Mobile app (React Native) — planned for Phase 3
- AI-powered grading suggestions — planned for Phase 2
- Payment / subscription tiers
- Multi-language / i18n support
- Offline mode / PWA
- Whiteboard / collaborative document editing during live sessions

