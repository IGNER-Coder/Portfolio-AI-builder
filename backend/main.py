from dotenv import load_dotenv
import os
from fastapi import FastAPI, HTTPException
from supabase import create_client, Client
import importlib
try:
    genai = importlib.import_module("google.generativeai")
except Exception as e:
    raise ImportError("The 'google.generativeai' module is required. Install it with: pip install google-generativeai") from e
import uuid
from datetime import datetime
from pydantic import BaseModel, Field
import json
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# CORS middleware setup
origins = [
    "http://localhost:5173",  # Your React dev server
    "https://illustrious-gecko-95fc8a.netlify.app", # Without trailing slash
    "https://illustrious-gecko-95fc8a.netlify.app/"  # With trailing slash
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client initialization
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Gemini API Key initialization
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
# Use a model that's great at JSON mode
model = genai.GenerativeModel('gemini-pro-latest')

# --- Pydantic Models ---

# For API request bodies
class SkillRequest(BaseModel):
    skill: str

class ChatRequest(BaseModel):
    task_id: str
    question: str

class CodeReviewRequest(BaseModel):
    task_id: str
    code: str

class CompleteTaskRequest(BaseModel):
    task_id: str
    deliverable_url: str

# For structured output from Gemini
class ProjectBriefOutput(BaseModel):
    client_name: str
    problem_statement: str
    core_requirements: list[str]
    key_deliverables: list[str]

class CodeReviewOutput(BaseModel):
    rating: int = Field(..., ge=1, le=10, description="The 1-10 rating for the code.")
    feedback: str = Field(..., description="Constructive feedback for the user.")
    skills_demonstrated: list[str] = Field(..., description="A list of skills the code demonstrates.")

# --- API Endpoints ---

@app.get("/config-check")
async def config_check():
    return {"configured_origins": origins}

@app.get("/")
async def read_root():
    return {"message": "Hello World"}


@app.get("/skills")
async def get_skills():
    response = supabase.from_('skill_prompts').select('skill_key').eq('is_active', True).execute()
    if response.data:
        skills = [item['skill_key'] for item in response.data]
        return {"skills": skills}
    return {"skills": []}

@app.get("/task/current")
async def get_current_task():
    try:
        response = supabase.from_('tasks').select('*').eq('status', 'in_progress').limit(1).execute()
        if hasattr(response, 'error') and response.error:
            raise HTTPException(status_code=500, detail=f"Supabase error: {response.error.message}")
        
        if response.data:
            return {"task": response.data[0]}
        return {"task": None}
    except Exception as e:
        print(f"An unexpected error occurred in get_current_task: {e}") # For logging in Render
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")

@app.post("/task/start")
async def start_task(request: SkillRequest):
    # Lock-In Check
    current_task_response = await get_current_task()
    if current_task_response["task"]:
        raise HTTPException(status_code=409, detail="A task is already in progress. Complete it before starting a new one.")

    skill = request.skill
    
    # Query Supabase for the prompt
    prompt_response = supabase.from_('skill_prompts').select('prompt_text').eq('skill_key', skill).eq('is_active', True).limit(1).execute()
    if not prompt_response.data:
        raise HTTPException(status_code=404, detail=f"No active prompt found for skill: {skill}")
    
    prompt = prompt_response.data[0]['prompt_text']

    # For now, we will assume the prompts in the DB are updated to ask for JSON.
    # A more robust solution would be to have a version field or a different table for JSON prompts.
    generation_config = {
        "response_mime_type": "application/json",
    }

    try:
        # Use the async version of the Gemini client
        response = await model.generate_content_async(
            prompt,
            generation_config=generation_config
        )
        
        # Validate the JSON output with Pydantic
        brief_json = json.loads(response.text)
        validated_brief = ProjectBriefOutput.model_validate(brief_json)

        # Format the structured brief into a readable markdown string for frontend
        project_brief_text = f"""
### Client: {validated_brief.client_name}

**Problem:** {validated_brief.problem_statement}

**Core Requirements:**
{chr(10).join([f'- {req}' for req in validated_brief.core_requirements])}

**Key Deliverables:**
{chr(10).join([f'- {deliv}' for deliv in validated_brief.key_deliverables])}
"""

    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate or parse project brief: {e}")

    task_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()

    new_task = {
        "id": task_id,
        "created_at": created_at,
        "skill": skill,
        "status": "in_progress",
        "project_brief": project_brief_text,
        "deliverable_url": None
    }

    insert_response = supabase.from_('tasks').insert(new_task).execute()
    if insert_response.data:
        return {"task": insert_response.data[0]}
    raise HTTPException(status_code=500, detail="Failed to create new task.")

@app.post("/task/complete")
async def complete_task(request: CompleteTaskRequest):
    response = supabase.from_('tasks').update({'status': 'completed', 'deliverable_url': request.deliverable_url}).eq('id', request.task_id).execute()
    if response.data:
        return {"success": True, "task": response.data[0]}
    raise HTTPException(status_code=500, detail="Failed to complete task or task not found.")

@app.get("/portfolio/completed_tasks")
async def get_completed_tasks():
    response = supabase.from_('tasks').select('*').eq('status', 'completed').order('created_at', desc=True).execute()
    if response.data:
        return {"completed_tasks": response.data}
    return {"completed_tasks": []}

@app.post("/task/chat")
async def chat_with_mentor(request: ChatRequest):
    # 1. Fetch task and chat history
    task_response = supabase.from_('tasks').select('project_brief').eq('id', request.task_id).execute()
    if not task_response.data:
        raise HTTPException(status_code=404, detail="Task not found.")
    project_brief = task_response.data[0]['project_brief']

    chat_history_response = supabase.from_('chat_messages').select('role, content').eq('task_id', request.task_id).order('created_at').execute()

    # 2. Format history for Gemini
    gemini_history = []
    for msg in chat_history_response.data:
        gemini_history.append({'role': msg['role'], 'parts': [msg['content']]})

    # 3. Start a chat session and send the new message
    try:
        chat_session = model.start_chat(history=gemini_history)
        
        # Context-augmented prompt
        mentor_prompt = f"""You are a helpful senior developer and project manager. The user has been assigned the following project brief: '{project_brief}'. The user's question is: '{request.question}'. Your task is to answer the user's question, providing guidance, breaking down the first steps, and explaining the skills being tested. Be encouraging and clear, keeping our previous conversation in mind."""

        response = await chat_session.send_message_async(mentor_prompt)
        answer = response.text

        # 4. Save *both* messages to the database
        messages_to_save = [
            {'task_id': request.task_id, 'role': 'user', 'content': request.question},
            {'task_id': request.task_id, 'role': 'model', 'content': answer}
        ]
        supabase.from_('chat_messages').insert(messages_to_save).execute()

        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get mentor response: {e}")

@app.post("/task/rate_code")
async def rate_code(request: CodeReviewRequest):
    # Fetch the task brief to give context to the AI for code review
    response = supabase.from_('tasks').select('project_brief').eq('id', request.task_id).limit(1).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Task not found.")
    
    project_brief = response.data[0]['project_brief']

    # 1. Get the JSON schema from your Pydantic model
    review_schema = CodeReviewOutput.model_json_schema()

    # 2. Update your prompt
    code_review_prompt = f"""You are a senior software engineer and a helpful mentor. The user has completed a task based on the following project brief: '{project_brief}'. They have submitted the following code (or a link to code): '{request.code}'.

Please provide a code review. Respond *only* with a JSON object that matches the following schema:
{json.dumps(review_schema, indent=2)}
"""

    # 3. Set the generation config
    generation_config = {
        "response_mime_type": "application/json",
    }

    try:
        # 4. Use the async version of the Gemini client
        response = await model.generate_content_async(
            code_review_prompt,
            generation_config=generation_config
        )

        # 5. The response *is* JSON. Parse and re-validate with Pydantic.
        review_json = json.loads(response.text)
        validated_review = CodeReviewOutput.model_validate(review_json)

        # Return the structured JSON, not just text
        # The frontend was expecting a 'rating' key with text, so we'll format it
        # into a markdown string to maintain compatibility while using the new structure.
        rating_text = f"""
### Rating: {validated_review.rating}/10

**Feedback:**
{validated_review.feedback}

**Skills Demonstrated:**
{chr(10).join([f'- {skill}' for skill in validated_review.skills_demonstrated])}
"""
        return {"rating": rating_text}
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=500, detail=f"Failed to get or parse code review: {e}")