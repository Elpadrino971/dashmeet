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
    created_by: Optional[str] = None  # user_id who created the task
    started_at: Optional[datetime] = None  # when status changed to in_progress
    estimated_hours: Optional[float] = None  # estimated time to complete
    actual_hours: Optional[float] = None  # actual time spent

class TaskActivity(BaseModel):
    activity_id: str = Field(default_factory=lambda: f"act_{uuid.uuid4().hex[:8]}")
    task_id: str
    user_id: str
    user_name: str
    user_email: str
    action: str  # created, updated, status_changed, commented, completed
    field_changed: Optional[str] = None  # status, priority, assignee, etc.
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    comment: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Goal(BaseModel):
    goal_id: str = Field(default_factory=lambda: f"goal_{uuid.uuid4().hex[:8]}")
    user_id: str
    user_email: str
    title: str
    description: Optional[str] = None
    goal_type: str  # tasks_completed, meetings_held, tasks_on_time, completion_rate
    period: str  # daily, weekly, monthly
    target_value: float  # Objectif chiffré
    current_value: float = 0.0  # Valeur actuelle
    start_date: datetime
    end_date: datetime
    status: str = "in_progress"  # in_progress, completed, failed
    is_validated: bool = False  # Coché par l'utilisateur
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
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

class TaskCommentRequest(BaseModel):
    task_id: str
    comment: str

class GenerateReportRequest(BaseModel):
    meeting_id: str
    include_all_participants: bool = True
    specific_emails: Optional[List[str]] = None

class AssistantQueryRequest(BaseModel):
    query: str
    context: dict
    use_web_search: bool = False

class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    goal_type: str  # tasks_completed, meetings_held, tasks_on_time, completion_rate
    period: str  # daily, weekly, monthly
    target_value: float
    start_date: datetime
    end_date: datetime

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_value: Optional[float] = None
    is_validated: Optional[bool] = None

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

# ==================== HELPER: TASK ACTIVITY LOGGING ====================

async def log_task_activity(
    task_id: str,
    user: dict,
    action: str,
    field_changed: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    comment: Optional[str] = None
):
    """Log task activity for tracking"""
    activity = {
        "activity_id": f"act_{uuid.uuid4().hex[:8]}",
        "task_id": task_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "action": action,
        "field_changed": field_changed,
        "old_value": old_value,
        "new_value": new_value,
        "comment": comment,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.task_activities.insert_one(activity)

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

@api_router.post("/meetings/{meeting_id}/transcript")
async def update_meeting_transcript(meeting_id: str, request: Request):
    """Update meeting transcript"""
    user = await get_user_from_request(request)
    body = await request.json()

    await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"meeting_transcript": body.get("transcript", "")}}
    )

    return {"message": "Transcript updated"}

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
        meeting_id=task_data.meeting_id,
        created_by=user["user_id"]
    )

    task_dict = task.model_dump()
    task_dict["created_at"] = task_dict["created_at"].isoformat()
    if task_dict.get("due_date"):
        task_dict["due_date"] = task_dict["due_date"].isoformat()

    await db.tasks.insert_one(task_dict)

    # Log activity
    await log_task_activity(
        task_id=task.task_id,
        user=user,
        action="created",
        new_value=f"Tâche créée: {task.title}"
    )

    return {"task_id": task.task_id, "message": "Task created"}

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_data: TaskUpdate, request: Request):
    """Update a task"""
    user = await get_user_from_request(request)

    # Get current task state for comparison
    current_task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not current_task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = {k: v for k, v in task_data.model_dump().items() if v is not None}

    # Track status changes
    if "status" in update_data:
        old_status = current_task.get("status")
        new_status = update_data["status"]

        if new_status == "in_progress" and old_status != "in_progress":
            update_data["started_at"] = datetime.now(timezone.utc).isoformat()

        if new_status == "completed" and old_status != "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

            # Calculate actual hours if started_at exists
            if current_task.get("started_at"):
                started = datetime.fromisoformat(current_task["started_at"].replace('Z', '+00:00'))
                completed = datetime.now(timezone.utc)
                hours = (completed - started).total_seconds() / 3600
                update_data["actual_hours"] = round(hours, 2)

        # Log status change
        await log_task_activity(
            task_id=task_id,
            user=user,
            action="status_changed",
            field_changed="status",
            old_value=old_status,
            new_value=new_status
        )

    # Log other field changes
    for field in ["priority", "assignee_email", "title"]:
        if field in update_data and update_data[field] != current_task.get(field):
            await log_task_activity(
                task_id=task_id,
                user=user,
                action="updated",
                field_changed=field,
                old_value=str(current_task.get(field)),
                new_value=str(update_data[field])
            )

    if "due_date" in update_data and update_data["due_date"]:
        update_data["due_date"] = update_data["due_date"].isoformat()

    await db.tasks.update_one({"task_id": task_id}, {"$set": update_data})

    return {"message": "Task updated"}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    """Delete a task"""
    user = await get_user_from_request(request)

    await db.tasks.delete_one({"task_id": task_id})

    # Log deletion
    await log_task_activity(
        task_id=task_id,
        user=user,
        action="deleted"
    )

    return {"message": "Task deleted"}

@api_router.get("/tasks/{task_id}/activity")
async def get_task_activity(task_id: str, request: Request):
    """Get activity history for a task"""
    user = await get_user_from_request(request)

    activities = await db.task_activities.find(
        {"task_id": task_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)

    return activities

@api_router.post("/tasks/{task_id}/comment")
async def add_task_comment(task_id: str, request: Request):
    """Add a comment to a task"""
    user = await get_user_from_request(request)
    body = await request.json()

    comment = body.get("comment", "")
    if not comment:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    # Log comment
    await log_task_activity(
        task_id=task_id,
        user=user,
        action="commented",
        comment=comment
    )

    return {"message": "Comment added"}

@api_router.get("/tasks/analytics/overview")
async def get_tasks_analytics(request: Request, meeting_id: Optional[str] = None):
    """Get tasks analytics and efficiency metrics"""
    user = await get_user_from_request(request)

    # Build query
    query = {"assignee_email": user["email"]}
    if meeting_id:
        query["meeting_id"] = meeting_id

    # Get all tasks
    all_tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)

    # Calculate metrics
    total_tasks = len(all_tasks)
    completed_tasks = [t for t in all_tasks if t.get("status") == "completed"]
    in_progress_tasks = [t for t in all_tasks if t.get("status") == "in_progress"]
    pending_tasks = [t for t in all_tasks if t.get("status") == "pending"]

    # Completion rate
    completion_rate = (len(completed_tasks) / total_tasks * 100) if total_tasks > 0 else 0

    # Average completion time (in hours)
    completion_times = []
    for task in completed_tasks:
        if task.get("started_at") and task.get("completed_at"):
            started = datetime.fromisoformat(task["started_at"].replace('Z', '+00:00'))
            completed = datetime.fromisoformat(task["completed_at"].replace('Z', '+00:00'))
            hours = (completed - started).total_seconds() / 3600
            completion_times.append(hours)

    avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0

    # Overdue tasks
    now = datetime.now(timezone.utc)
    overdue_tasks = []
    for task in all_tasks:
        if task.get("status") != "completed" and task.get("due_date"):
            due = datetime.fromisoformat(task["due_date"].replace('Z', '+00:00'))
            if due < now:
                overdue_tasks.append(task)

    # Priority breakdown
    priority_breakdown = {
        "high": len([t for t in all_tasks if t.get("priority") == "high"]),
        "medium": len([t for t in all_tasks if t.get("priority") == "medium"]),
        "low": len([t for t in all_tasks if t.get("priority") == "low"])
    }

    # Estimated vs Actual hours (for completed tasks with estimates)
    estimated_vs_actual = []
    for task in completed_tasks:
        if task.get("estimated_hours") and task.get("actual_hours"):
            estimated_vs_actual.append({
                "task_id": task["task_id"],
                "title": task["title"],
                "estimated": task["estimated_hours"],
                "actual": task["actual_hours"],
                "variance": task["actual_hours"] - task["estimated_hours"]
            })

    return {
        "total_tasks": total_tasks,
        "completed_tasks": len(completed_tasks),
        "in_progress_tasks": len(in_progress_tasks),
        "pending_tasks": len(pending_tasks),
        "overdue_tasks": len(overdue_tasks),
        "completion_rate": round(completion_rate, 2),
        "avg_completion_time_hours": round(avg_completion_time, 2),
        "priority_breakdown": priority_breakdown,
        "estimated_vs_actual": estimated_vs_actual,
        "overdue_task_details": overdue_tasks[:5]  # Return top 5 overdue
    }

# ==================== GOALS ENDPOINTS ====================

@api_router.get("/goals")
async def get_goals(request: Request, period: Optional[str] = None):
    """Get all goals for current user"""
    user = await get_user_from_request(request)

    query = {"user_email": user["email"]}
    if period:
        query["period"] = period

    goals = await db.goals.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Update current_value for each goal based on actual data
    for goal in goals:
        goal["current_value"] = await calculate_goal_progress(user, goal)

        # Auto-update status
        if goal["current_value"] >= goal["target_value"]:
            goal["status"] = "completed"
        elif datetime.fromisoformat(goal["end_date"].replace('Z', '+00:00')) < datetime.now(timezone.utc):
            goal["status"] = "failed"

        # Update in DB
        await db.goals.update_one(
            {"goal_id": goal["goal_id"]},
            {"$set": {
                "current_value": goal["current_value"],
                "status": goal["status"]
            }}
        )

    return goals

async def calculate_goal_progress(user: dict, goal: dict) -> float:
    """Calculate current progress for a goal"""
    start_date = datetime.fromisoformat(goal["start_date"].replace('Z', '+00:00'))
    end_date = datetime.fromisoformat(goal["end_date"].replace('Z', '+00:00'))

    goal_type = goal["goal_type"]

    if goal_type == "tasks_completed":
        # Count completed tasks in period
        tasks = await db.tasks.find({
            "assignee_email": user["email"],
            "status": "completed",
            "completed_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }, {"_id": 0}).to_list(1000)
        return float(len(tasks))

    elif goal_type == "meetings_held":
        # Count completed meetings in period
        meetings = await db.meetings.find({
            "$or": [
                {"organizer_id": user["user_id"]},
                {"participants": user["email"]}
            ],
            "status": "completed",
            "completed_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }, {"_id": 0}).to_list(1000)
        return float(len(meetings))

    elif goal_type == "tasks_on_time":
        # Count tasks completed on time
        tasks = await db.tasks.find({
            "assignee_email": user["email"],
            "status": "completed",
            "completed_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }, {"_id": 0}).to_list(1000)

        on_time_count = 0
        for task in tasks:
            if task.get("due_date") and task.get("completed_at"):
                due = datetime.fromisoformat(task["due_date"].replace('Z', '+00:00'))
                completed = datetime.fromisoformat(task["completed_at"].replace('Z', '+00:00'))
                if completed <= due:
                    on_time_count += 1
        return float(on_time_count)

    elif goal_type == "completion_rate":
        # Calculate completion rate %
        all_tasks = await db.tasks.find({
            "assignee_email": user["email"],
            "created_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }, {"_id": 0}).to_list(1000)

        if len(all_tasks) == 0:
            return 0.0

        completed = len([t for t in all_tasks if t.get("status") == "completed"])
        return round((completed / len(all_tasks)) * 100, 2)

    return 0.0

@api_router.post("/goals")
async def create_goal(goal_data: GoalCreate, request: Request):
    """Create a new goal"""
    user = await get_user_from_request(request)

    goal = Goal(
        user_id=user["user_id"],
        user_email=user["email"],
        title=goal_data.title,
        description=goal_data.description,
        goal_type=goal_data.goal_type,
        period=goal_data.period,
        target_value=goal_data.target_value,
        start_date=goal_data.start_date,
        end_date=goal_data.end_date
    )

    goal_dict = goal.model_dump()
    goal_dict["start_date"] = goal_dict["start_date"].isoformat()
    goal_dict["end_date"] = goal_dict["end_date"].isoformat()
    goal_dict["created_at"] = goal_dict["created_at"].isoformat()

    await db.goals.insert_one(goal_dict)

    return {"goal_id": goal.goal_id, "message": "Goal created"}

@api_router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, goal_data: GoalUpdate, request: Request):
    """Update a goal"""
    user = await get_user_from_request(request)

    update_data = {k: v for k, v in goal_data.model_dump().items() if v is not None}

    if update_data:
        await db.goals.update_one({"goal_id": goal_id}, {"$set": update_data})

    return {"message": "Goal updated"}

@api_router.post("/goals/{goal_id}/validate")
async def validate_goal(goal_id: str, request: Request):
    """Mark goal as validated (checked)"""
    user = await get_user_from_request(request)

    await db.goals.update_one(
        {"goal_id": goal_id},
        {"$set": {
            "is_validated": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"message": "Goal validated"}

@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, request: Request):
    """Delete a goal"""
    user = await get_user_from_request(request)

    await db.goals.delete_one({"goal_id": goal_id})
    return {"message": "Goal deleted"}

@api_router.get("/goals/analytics")
async def get_goals_analytics(request: Request):
    """Get goals analytics"""
    user = await get_user_from_request(request)

    all_goals = await db.goals.find({"user_email": user["email"]}, {"_id": 0}).to_list(1000)

    total_goals = len(all_goals)
    completed_goals = len([g for g in all_goals if g.get("status") == "completed"])
    failed_goals = len([g for g in all_goals if g.get("status") == "failed"])
    in_progress_goals = len([g for g in all_goals if g.get("status") == "in_progress"])

    # Success rate
    success_rate = (completed_goals / total_goals * 100) if total_goals > 0 else 0

    # Average variance (écart réel vs projeté)
    variances = []
    for goal in all_goals:
        if goal.get("current_value") is not None and goal.get("target_value"):
            variance = goal["current_value"] - goal["target_value"]
            variance_pct = (variance / goal["target_value"] * 100) if goal["target_value"] > 0 else 0
            variances.append({
                "goal_id": goal["goal_id"],
                "title": goal["title"],
                "target": goal["target_value"],
                "current": goal["current_value"],
                "variance": variance,
                "variance_pct": round(variance_pct, 2)
            })

    return {
        "total_goals": total_goals,
        "completed_goals": completed_goals,
        "failed_goals": failed_goals,
        "in_progress_goals": in_progress_goals,
        "success_rate": round(success_rate, 2),
        "variances": variances
    }

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

# ==================== AI ASSISTANT ====================

@api_router.post("/assistant/query")
async def assistant_query(query_request: AssistantQueryRequest, request: Request):
    """AI assistant for live meeting support"""
    user = await get_user_from_request(request)

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    try:
        context = query_request.context
        query = query_request.query

        # Build context prompt
        context_parts = []

        if context.get("meeting_title"):
            context_parts.append(f"RÉUNION: {context['meeting_title']}")

        if context.get("meeting_description"):
            context_parts.append(f"Description: {context['meeting_description']}")

        if context.get("agenda"):
            agenda_text = "\n".join([
                f"- {item.get('title', 'N/A')} ({item.get('duration', 0)} min) - Intervenant: {item.get('speaker', 'N/A')} - Statut: {item.get('status', 'N/A')}"
                for item in context['agenda']
            ])
            context_parts.append(f"\nORDRE DU JOUR:\n{agenda_text}")

        if context.get("current_item"):
            current = context['current_item']
            context_parts.append(f"\nSUJET EN COURS: {current.get('title', 'N/A')} - {current.get('description', '')}")

        if context.get("meeting_notes"):
            context_parts.append(f"\nNOTES DE RÉUNION:\n{context['meeting_notes']}")

        if context.get("transcript"):
            context_parts.append(f"\nTRANSCRIPTION AUDIO:\n{context['transcript'][:2000]}")  # Limit transcript length

        if context.get("participants"):
            context_parts.append(f"\nPARTICIPANTS: {', '.join(context['participants'])}")

        context_str = "\n".join(context_parts)

        # Web search if requested
        web_results = []
        if query_request.use_web_search:
            try:
                async with httpx.AsyncClient(timeout=10.0) as http_client:
                    # Using DuckDuckGo instant answer API (free, no API key needed)
                    search_response = await http_client.get(
                        "https://api.duckduckgo.com/",
                        params={"q": query, "format": "json", "no_html": 1}
                    )
                    if search_response.status_code == 200:
                        data = search_response.json()
                        if data.get("AbstractText"):
                            web_results.append({
                                "title": data.get("Heading", "DuckDuckGo Result"),
                                "snippet": data.get("AbstractText"),
                                "url": data.get("AbstractURL", "")
                            })

                        # Add related topics
                        for topic in data.get("RelatedTopics", [])[:3]:
                            if isinstance(topic, dict) and topic.get("Text"):
                                web_results.append({
                                    "title": topic.get("Text", "")[:100],
                                    "snippet": topic.get("Text", ""),
                                    "url": topic.get("FirstURL", "")
                                })
            except Exception as e:
                logging.warning(f"Web search failed: {str(e)}")

        # Build final prompt
        if web_results:
            web_context = "\n\nRÉSULTATS DE RECHERCHE WEB:\n" + "\n".join([
                f"- {r['title']}: {r['snippet'][:200]} (Source: {r['url']})"
                for r in web_results
            ])
            context_str += web_context

        prompt = f"""Tu es un assistant IA pour une réunion en cours. Voici le contexte de la réunion:

{context_str}

QUESTION DE L'UTILISATEUR:
{query}

Instructions:
- Réponds de manière concise et actionnable
- Si des recherches web sont fournies, cite les sources
- Suggère des actions concrètes si pertinent
- Utilise un ton professionnel mais accessible
- Réponds en français
"""

        # Call Claude with meeting_id as session for conversation history
        meeting_id = context.get("meeting_id", "default")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"assistant_meeting_{meeting_id}",  # Same session per meeting for continuity
            system_message="Tu es un assistant IA spécialisé dans la gestion de réunions professionnelles. Tu fournis des réponses claires, concises et actionnables en français."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        response_text = await chat.send_message(UserMessage(text=prompt))

        # Format sources
        sources = [{"title": r["title"], "url": r["url"]} for r in web_results if r.get("url")]

        return {
            "response": response_text,
            "sources": sources,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logging.error(f"Assistant query error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing query")

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
