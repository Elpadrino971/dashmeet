from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="COPIL Master API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AgendaItem(BaseModel):
    item_id: str = Field(default_factory=lambda: f"item_{uuid.uuid4().hex[:8]}")
    title: str
    duration_minutes: int = 10
    speaker: Optional[str] = None
    description: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed, skipped
    actual_duration: Optional[int] = None
    notes: Optional[str] = None

class Task(BaseModel):
    task_id: str = Field(default_factory=lambda: f"task_{uuid.uuid4().hex[:8]}")
    title: str
    description: Optional[str] = None
    assignee_email: str
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str = "pending"  # pending, in_progress, completed
    priority: str = "medium"  # low, medium, high
    meeting_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class Meeting(BaseModel):
    meeting_id: str = Field(default_factory=lambda: f"mtg_{uuid.uuid4().hex[:8]}")
    title: str
    description: Optional[str] = None
    scheduled_date: datetime
    organizer_id: str
    organizer_name: str
    participants: List[str] = []  # List of emails
    agenda: List[AgendaItem] = []
    status: str = "scheduled"  # scheduled, in_progress, completed, cancelled
    current_item_index: int = 0
    timer_started_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    meeting_notes: Optional[str] = None
    ai_summary: Optional[str] = None

class Report(BaseModel):
    report_id: str = Field(default_factory=lambda: f"rpt_{uuid.uuid4().hex[:8]}")
    meeting_id: str
    meeting_title: str
    recipient_email: str
    recipient_name: Optional[str] = None
    content: str
    tasks: List[dict] = []
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sent: bool = False

# ==================== REQUEST/RESPONSE MODELS ====================

class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_date: datetime
    participants: List[str] = []
    agenda: List[dict] = []

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    participants: Optional[List[str]] = None
    agenda: Optional[List[dict]] = None
    meeting_notes: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_email: str
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "medium"
    meeting_id: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None

class GenerateReportRequest(BaseModel):
    meeting_id: str
    include_all_participants: bool = True
    specific_emails: Optional[List[str]] = None

# ==================== AUTH ENDPOINTS ====================

@api_router.get("/auth/session")
async def get_session(request: Request):
    """Exchange session_id for user data"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session ID")
    
    async with httpx.AsyncClient() as client_http:
        resp = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        data = resp.json()
    
    # Create or update user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    
    if existing:
        user_id = existing["user_id"]
    else:
        user_doc = {
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "picture": data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Store session
    session_token = data["session_token"]
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response_data = {
        "user_id": user_id,
        "email": data["email"],
        "name": data["name"],
        "picture": data.get("picture"),
        "session_token": session_token
    }
    
    return response_data

@api_router.get("/auth/me")
async def get_current_user(request: Request):
    """Get current user from session token"""
    token = None
    
    # Check cookies first
    token = request.cookies.get("session_token")
    
    # Check Authorization header as fallback
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    # Check expiry
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    response.delete_cookie("session_token")
    return {"message": "Logged out"}

# ==================== HELPER: GET USER ====================

async def get_user_from_request(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

# ==================== MEETINGS ENDPOINTS ====================

@api_router.get("/meetings")
async def get_meetings(request: Request):
    """Get all meetings for current user"""
    user = await get_user_from_request(request)
    
    # Get meetings where user is organizer or participant
    meetings = await db.meetings.find(
        {"$or": [
            {"organizer_id": user["user_id"]},
            {"participants": user["email"]}
        ]},
        {"_id": 0}
    ).sort("scheduled_date", -1).to_list(100)
    
    return meetings

@api_router.post("/meetings")
async def create_meeting(meeting_data: MeetingCreate, request: Request):
    """Create a new meeting"""
    user = await get_user_from_request(request)
    
    meeting = Meeting(
        title=meeting_data.title,
        description=meeting_data.description,
        scheduled_date=meeting_data.scheduled_date,
        organizer_id=user["user_id"],
        organizer_name=user["name"],
        participants=meeting_data.participants,
        agenda=[AgendaItem(**item) for item in meeting_data.agenda]
    )
    
    meeting_dict = meeting.model_dump()
    meeting_dict["scheduled_date"] = meeting_dict["scheduled_date"].isoformat()
    meeting_dict["created_at"] = meeting_dict["created_at"].isoformat()
    meeting_dict["agenda"] = [
        {**item, "item_id": item.get("item_id", f"item_{uuid.uuid4().hex[:8]}")} 
        for item in meeting_dict["agenda"]
    ]
    
    await db.meetings.insert_one(meeting_dict)
    
    return {"meeting_id": meeting.meeting_id, "message": "Meeting created"}

@api_router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, request: Request):
    """Get a specific meeting"""
    user = await get_user_from_request(request)
    
    meeting = await db.meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    return meeting

@api_router.put("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, meeting_data: MeetingUpdate, request: Request):
    """Update a meeting"""
    user = await get_user_from_request(request)
    
    meeting = await db.meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    update_data = {k: v for k, v in meeting_data.model_dump().items() if v is not None}
    if "scheduled_date" in update_data:
        update_data["scheduled_date"] = update_data["scheduled_date"].isoformat()
    
    if update_data:
        await db.meetings.update_one(
            {"meeting_id": meeting_id},
            {"$set": update_data}
        )
    
    return {"message": "Meeting updated"}

@api_router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, request: Request):
    """Delete a meeting"""
    user = await get_user_from_request(request)
    
    result = await db.meetings.delete_one({"meeting_id": meeting_id, "organizer_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meeting not found or not authorized")
    
    return {"message": "Meeting deleted"}

# ==================== TIMER/MEETING CONTROL ====================

@api_router.post("/meetings/{meeting_id}/start")
async def start_meeting(meeting_id: str, request: Request):
    """Start a meeting"""
    user = await get_user_from_request(request)
    
    await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {
            "status": "in_progress",
            "timer_started_at": datetime.now(timezone.utc).isoformat(),
            "current_item_index": 0
        }}
    )
    
    # Update first agenda item
    await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"agenda.0.status": "in_progress"}}
    )
    
    return {"message": "Meeting started"}

@api_router.post("/meetings/{meeting_id}/next-item")
async def next_agenda_item(meeting_id: str, request: Request):
    """Move to next agenda item"""
    user = await get_user_from_request(request)
    
    meeting = await db.meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    current_idx = meeting.get("current_item_index", 0)
    agenda = meeting.get("agenda", [])
    
    if current_idx < len(agenda):
        # Mark current as completed
        await db.meetings.update_one(
            {"meeting_id": meeting_id},
            {"$set": {f"agenda.{current_idx}.status": "completed"}}
        )
    
    next_idx = current_idx + 1
    if next_idx < len(agenda):
        await db.meetings.update_one(
            {"meeting_id": meeting_id},
            {"$set": {
                "current_item_index": next_idx,
                f"agenda.{next_idx}.status": "in_progress",
                "timer_started_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Moved to next item", "current_index": next_idx}
    else:
        return {"message": "No more items", "current_index": current_idx}

@api_router.post("/meetings/{meeting_id}/complete")
async def complete_meeting(meeting_id: str, request: Request):
    """Complete a meeting"""
    user = await get_user_from_request(request)
    
    await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Meeting completed"}

@api_router.post("/meetings/{meeting_id}/notes")
async def update_meeting_notes(meeting_id: str, request: Request):
    """Update meeting notes"""
    user = await get_user_from_request(request)
    body = await request.json()
    
    await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"meeting_notes": body.get("notes", "")}}
    )
    
    return {"message": "Notes updated"}

# ==================== TASKS ENDPOINTS ====================

@api_router.get("/tasks")
async def get_tasks(request: Request, meeting_id: Optional[str] = None):
    """Get tasks for current user"""
    user = await get_user_from_request(request)
    
    query = {"assignee_email": user["email"]}
    if meeting_id:
        query["meeting_id"] = meeting_id
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tasks

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, request: Request):
    """Create a new task"""
    user = await get_user_from_request(request)
    
    task = Task(
        title=task_data.title,
        description=task_data.description,
        assignee_email=task_data.assignee_email,
        assignee_name=task_data.assignee_name,
        due_date=task_data.due_date,
        priority=task_data.priority,
        meeting_id=task_data.meeting_id
    )
    
    task_dict = task.model_dump()
    task_dict["created_at"] = task_dict["created_at"].isoformat()
    if task_dict.get("due_date"):
        task_dict["due_date"] = task_dict["due_date"].isoformat()
    
    await db.tasks.insert_one(task_dict)
    
    return {"task_id": task.task_id, "message": "Task created"}

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_data: TaskUpdate, request: Request):
    """Update a task"""
    user = await get_user_from_request(request)
    
    update_data = {k: v for k, v in task_data.model_dump().items() if v is not None}
    
    if update_data.get("status") == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    if "due_date" in update_data and update_data["due_date"]:
        update_data["due_date"] = update_data["due_date"].isoformat()
    
    await db.tasks.update_one({"task_id": task_id}, {"$set": update_data})
    
    return {"message": "Task updated"}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    """Delete a task"""
    user = await get_user_from_request(request)
    
    await db.tasks.delete_one({"task_id": task_id})
    return {"message": "Task deleted"}

# ==================== AI REPORTS ====================

@api_router.post("/reports/generate")
async def generate_reports(report_request: GenerateReportRequest, request: Request, background_tasks: BackgroundTasks):
    """Generate AI reports for meeting participants"""
    user = await get_user_from_request(request)
    
    meeting = await db.meetings.find_one({"meeting_id": report_request.meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get participants
    participants = []
    if report_request.include_all_participants:
        participants = meeting.get("participants", [])
        # Add organizer
        organizer = await db.users.find_one({"user_id": meeting["organizer_id"]}, {"_id": 0})
        if organizer and organizer["email"] not in participants:
            participants.append(organizer["email"])
    elif report_request.specific_emails:
        participants = report_request.specific_emails
    
    # Get tasks for this meeting
    tasks = await db.tasks.find({"meeting_id": report_request.meeting_id}, {"_id": 0}).to_list(100)
    
    # Generate reports in background
    background_tasks.add_task(generate_reports_async, meeting, participants, tasks)
    
    return {"message": f"Generating reports for {len(participants)} participants"}

async def generate_reports_async(meeting: dict, participants: List[str], all_tasks: List[dict]):
    """Generate AI reports asynchronously"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logging.error("EMERGENT_LLM_KEY not set")
        return
    
    for email in participants:
        try:
            # Filter tasks for this participant
            user_tasks = [t for t in all_tasks if t.get("assignee_email") == email]
            
            # Build prompt
            agenda_summary = "\n".join([
                f"- {item.get('title', 'N/A')} ({item.get('duration_minutes', 0)} min) - {item.get('status', 'N/A')}"
                for item in meeting.get("agenda", [])
            ])
            
            tasks_summary = "\n".join([
                f"- {t.get('title', 'N/A')} (Priorité: {t.get('priority', 'N/A')}, Échéance: {t.get('due_date', 'N/A')})"
                for t in user_tasks
            ]) if user_tasks else "Aucune tâche assignée"
            
            prompt = f"""Génère un rapport de réunion personnalisé et professionnel en français pour {email}.

RÉUNION: {meeting.get('title', 'N/A')}
DATE: {meeting.get('scheduled_date', 'N/A')}
ORGANISATEUR: {meeting.get('organizer_name', 'N/A')}

ORDRE DU JOUR:
{agenda_summary}

NOTES DE RÉUNION:
{meeting.get('meeting_notes', 'Aucune note disponible')}

TES TÂCHES ASSIGNÉES:
{tasks_summary}

Instructions:
1. Résume les points clés de la réunion
2. Liste les décisions importantes prises
3. Détaille les tâches assignées à ce participant avec les échéances
4. Suggère les prochaines étapes
5. Utilise un ton professionnel mais accessible
"""
            
            chat = LlmChat(
                api_key=api_key,
                session_id=f"report_{meeting.get('meeting_id')}_{email}",
                system_message="Tu es un assistant de gestion de réunions professionnelles. Tu génères des rapports clairs et actionnables en français."
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            response = await chat.send_message(UserMessage(text=prompt))
            
            # Save report
            report = {
                "report_id": f"rpt_{uuid.uuid4().hex[:8]}",
                "meeting_id": meeting.get("meeting_id"),
                "meeting_title": meeting.get("title"),
                "recipient_email": email,
                "content": response,
                "tasks": user_tasks,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "sent": False
            }
            
            await db.reports.insert_one(report)
            logging.info(f"Report generated for {email}")
            
        except Exception as e:
            logging.error(f"Error generating report for {email}: {str(e)}")

@api_router.get("/reports")
async def get_reports(request: Request, meeting_id: Optional[str] = None):
    """Get reports for current user"""
    user = await get_user_from_request(request)
    
    query = {"recipient_email": user["email"]}
    if meeting_id:
        query["meeting_id"] = meeting_id
    
    reports = await db.reports.find(query, {"_id": 0}).sort("generated_at", -1).to_list(100)
    return reports

@api_router.get("/reports/meeting/{meeting_id}")
async def get_meeting_reports(meeting_id: str, request: Request):
    """Get all reports for a meeting (organizer only)"""
    user = await get_user_from_request(request)
    
    meeting = await db.meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting or meeting.get("organizer_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    reports = await db.reports.find({"meeting_id": meeting_id}, {"_id": 0}).to_list(100)
    return reports

# ==================== EMAIL NOTIFICATIONS ====================

@api_router.post("/notifications/send-task")
async def send_task_notification(request: Request, background_tasks: BackgroundTasks):
    """Send task notification email"""
    user = await get_user_from_request(request)
    body = await request.json()
    
    task_id = body.get("task_id")
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Note: SendGrid requires API key setup
    # For MVP, we'll log the notification
    logging.info(f"Task notification would be sent to {task.get('assignee_email')}: {task.get('title')}")
    
    return {"message": "Notification queued"}

# ==================== STATS ====================

@api_router.get("/stats")
async def get_stats(request: Request):
    """Get dashboard stats for current user"""
    user = await get_user_from_request(request)
    
    # Count meetings
    total_meetings = await db.meetings.count_documents({
        "$or": [
            {"organizer_id": user["user_id"]},
            {"participants": user["email"]}
        ]
    })
    
    upcoming_meetings = await db.meetings.count_documents({
        "$or": [
            {"organizer_id": user["user_id"]},
            {"participants": user["email"]}
        ],
        "status": "scheduled"
    })
    
    # Count tasks
    pending_tasks = await db.tasks.count_documents({
        "assignee_email": user["email"],
        "status": {"$ne": "completed"}
    })
    
    completed_tasks = await db.tasks.count_documents({
        "assignee_email": user["email"],
        "status": "completed"
    })
    
    return {
        "total_meetings": total_meetings,
        "upcoming_meetings": upcoming_meetings,
        "pending_tasks": pending_tasks,
        "completed_tasks": completed_tasks
    }

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "COPIL Master API", "version": "1.0.0"}

# Include the router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
