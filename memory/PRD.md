# COPIL Master - Product Requirements Document

## Project Overview
**Application:** COPIL Master - Intelligent Meeting Management Platform
**Tech Stack:** FastAPI (Python) + React + MongoDB
**Created:** January 2025

## Original Problem Statement
Application de gestion de réunions COPIL avec:
- Timer pour suivre les ordres du jour et maîtriser les temps de parole
- IA pour générer des rapports ciblés pour tous les agents afin qu'ils soient informés de leurs tâches respectives
- Dispatch automatique des tâches
- Notifications avant/pendant/après réunion

## User Choices
- **AI Integration:** Claude Sonnet 4.5 via Emergent LLM Key
- **Authentication:** Google Auth via Emergent
- **Email Notifications:** SendGrid integration
- **Theme:** Dark + Light mode with toggle

## User Personas
1. **Project Manager** - Creates and organizes COPIL meetings, assigns tasks
2. **Team Member** - Participates in meetings, receives tasks, views reports
3. **Executive** - Reviews meeting summaries and progress

## Core Requirements (Static)
- [ ] User authentication (Google OAuth)
- [ ] Meeting CRUD operations
- [ ] Agenda management with time allocation
- [ ] Live meeting timer with visual countdown
- [ ] Task creation and assignment
- [ ] AI-powered report generation (Claude Sonnet)
- [ ] Email notifications (SendGrid)
- [ ] Dark/Light theme toggle

## What's Been Implemented (January 2025)
### Backend (FastAPI)
- ✅ MongoDB integration with Motor async driver
- ✅ Google OAuth via Emergent Authentication
- ✅ Meeting CRUD API endpoints
- ✅ Agenda items with duration tracking
- ✅ Timer control endpoints (start, next-item, complete)
- ✅ Task CRUD endpoints
- ✅ AI report generation with Claude Sonnet 4.5
- ✅ Stats dashboard endpoint
- ✅ Session management with cookies

### Frontend (React)
- ✅ Landing page with hero section
- ✅ Google Auth login flow
- ✅ Dashboard with stats cards
- ✅ Meeting creation form with agenda builder
- ✅ Meeting detail view
- ✅ Live meeting interface with circular timer
- ✅ Agenda progress tracking
- ✅ Meeting notes editor (auto-save)
- ✅ Tasks page with filters
- ✅ Reports page with AI content display
- ✅ Settings page with theme toggle
- ✅ Responsive sidebar navigation

### Design
- ✅ "Swiss Control Room" aesthetic
- ✅ Manrope + Inter + JetBrains Mono fonts
- ✅ Royal Blue primary + Orange for timer
- ✅ Glassmorphism for AI reports
- ✅ Dark/Light mode support

## Prioritized Backlog
### P0 (Critical)
- [x] Core meeting timer functionality
- [x] User authentication
- [x] Meeting creation and management

### P1 (High Priority)
- [ ] Email notifications via SendGrid (backend ready, needs API key)
- [ ] Real-time timer sync for multiple users
- [ ] Meeting participant invitations

### P2 (Medium Priority)
- [ ] Calendar integration (Google Calendar)
- [ ] Meeting templates
- [ ] Recurring meetings
- [ ] Task due date reminders

### P3 (Nice to Have)
- [ ] Meeting recording/transcription
- [ ] Analytics dashboard
- [ ] Export to PDF
- [ ] Slack integration

## Next Tasks
1. Configure SendGrid API key for email notifications
2. Add real-time WebSocket for timer sync
3. Implement meeting invitation emails
4. Add meeting templates feature
5. Calendar view for meetings

## Architecture
```
/app
├── backend/
│   ├── server.py          # FastAPI application
│   └── .env              # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   └── lib/          # API client
│   └── package.json
└── memory/
    └── PRD.md            # This file
```

## Testing Results
- Backend: 100% (14/14 tests passed)
- Frontend: 100% (26/26 tests passed)
- Integration: 100% (all flows working)
