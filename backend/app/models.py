from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    PARTICIPANT = "participant"


class RoundState(str, Enum):
    LOCKED = "LOCKED"
    READY = "READY"
    LIVE = "LIVE"
    CLOSED = "CLOSED"
    EVALUATION = "EVALUATION"
    COMPLETED = "COMPLETED"


class TeamStatus(str, Enum):
    ACTIVE = "ACTIVE"
    QUALIFIED_FOR_FINAL = "QUALIFIED_FOR_FINAL"
    ELIMINATED = "ELIMINATED"


# Auth Models
class Token(BaseModel):
    access_token: str
    token_type: str
    role: UserRole
    username: str
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    team: Optional[Dict[str, Any]] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None
    team_id: Optional[str] = None


class LoginRequest(BaseModel):
    username: str  # Can be username or email or team_id
    password: str


class RegisterParticipantRequest(BaseModel):
    team_id: str
    team_name: str
    leader_name: str
    email: EmailStr
    password: str
    institution: str
    members: List[str] = []


# Round Models
class RoundModel(BaseModel):
    id: Optional[str] = None
    round_number: int  # 1, 2, 3
    title: str
    subtitle: str
    icon: str
    status: RoundState = RoundState.LOCKED
    start_time: Optional[str] = None
    deadline: Optional[str] = None
    is_active: bool = False
    problem_published: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RoundStatusUpdate(BaseModel):
    status: RoundState
    start_time: Optional[str] = None
    deadline: Optional[str] = None


# Problem Statement Models
class ProblemStatementModel(BaseModel):
    id: Optional[str] = None
    problem_id: Optional[str] = None  # e.g., PS-01
    problem_number: Optional[int] = None  # 1..10
    round_number: int = 1
    title: str
    tagline: Optional[str] = None
    scenario: str
    description: str
    functional_requirements: List[str] = []
    technical_constraints: List[str] = []
    deliverables: List[str] = []
    evaluation_criteria: List[Dict[str, Any]] = []
    max_capacity: Optional[int] = 5
    is_published: bool = True
    attachments: List[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProblemStatementCreate(BaseModel):
    problem_id: Optional[str] = None
    problem_number: Optional[int] = None
    round_number: int = 1
    title: str
    tagline: Optional[str] = None
    scenario: str
    description: str
    functional_requirements: List[str] = []
    technical_constraints: List[str] = []
    deliverables: List[str] = []
    evaluation_criteria: List[Dict[str, Any]] = []
    max_capacity: Optional[int] = 5
    is_published: bool = True


class ProblemStatementUpdate(BaseModel):
    problem_id: Optional[str] = None
    problem_number: Optional[int] = None
    title: Optional[str] = None
    tagline: Optional[str] = None
    scenario: Optional[str] = None
    description: Optional[str] = None
    functional_requirements: Optional[List[str]] = None
    technical_constraints: Optional[List[str]] = None
    deliverables: Optional[List[str]] = None
    evaluation_criteria: Optional[List[Dict[str, Any]]] = None
    max_capacity: Optional[int] = None
    is_published: Optional[bool] = None


# Problem Statement Allocation Models
class AllocationConfigUpdate(BaseModel):
    max_teams_per_problem: Optional[int] = None
    is_automatic_enabled: Optional[bool] = None
    allocation_deadline: Optional[str] = None


class AllocationResetRequest(BaseModel):
    confirm_text: str  # Must match "RESET"
    reason: Optional[str] = "Race Director requested pool reshuffle"


class ResetEventRequest(BaseModel):
    confirm_text: str  # Must match "RESET"


# Submission Models
class SubmissionCreate(BaseModel):
    round_number: int
    github_url: Optional[str] = None
    deployed_url: Optional[str] = None
    deployment_instructions: Optional[str] = None
    implementation_summary: Optional[str] = None
    architecture_notes: Optional[str] = None
    recovery_strategy: Optional[str] = None


class SubmissionResponse(BaseModel):
    id: str
    team_id: str
    team_name: str
    round_number: int
    github_url: Optional[str] = None
    deployed_url: Optional[str] = None
    deployment_instructions: Optional[str] = None
    implementation_summary: Optional[str] = None
    architecture_notes: Optional[str] = None
    recovery_strategy: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    submitted_at: str
    is_late: bool = False
    score: Optional[float] = None
    feedback: Optional[str] = None


# Evaluation Models
class EvaluationSubmit(BaseModel):
    submission_id: str
    team_id: str
    round_number: int
    # Round 1 Specific Rubrics (Total 50 Marks)
    architecture_design: Optional[float] = Field(None, ge=0, le=12)
    service_selection: Optional[float] = Field(None, ge=0, le=8)
    scalability_performance: Optional[float] = Field(None, ge=0, le=8)
    security_protection: Optional[float] = Field(None, ge=0, le=7)
    high_availability: Optional[float] = Field(None, ge=0, le=7)
    cost_optimization: Optional[float] = Field(None, ge=0, le=4)
    technical_feasibility: Optional[float] = Field(None, ge=0, le=4)
    # Round 2 Specific Rubrics (Total 100 Marks)
    app_functionality: Optional[float] = Field(None, ge=0, le=15)
    cloud_deployment: Optional[float] = Field(None, ge=0, le=25)
    database_integration: Optional[float] = Field(None, ge=0, le=10)
    containerization: Optional[float] = Field(None, ge=0, le=10)
    auth_security: Optional[float] = Field(None, ge=0, le=15)
    object_storage: Optional[float] = Field(None, ge=0, le=10)
    monitoring_logging: Optional[float] = Field(None, ge=0, le=5)
    reliability_error_handling: Optional[float] = Field(None, ge=0, le=5)
    cloud_config_management: Optional[float] = Field(None, ge=0, le=5)
    # Round 3 Specific Rubrics (Total 50 Marks)
    crisis_challenge: Optional[float] = Field(None, ge=0, le=30)
    presentation: Optional[float] = Field(None, ge=0, le=20)
    # Generic Rubrics (Fallback)
    innovation_score: Optional[float] = Field(0.0, ge=0, le=20)
    functionality_score: Optional[float] = Field(0.0, ge=0, le=25)
    scalability_score: Optional[float] = Field(0.0, ge=0, le=20)
    crisis_handling_score: Optional[float] = Field(0.0, ge=0, le=20)
    presentation_score: Optional[float] = Field(0.0, ge=0, le=15)
    blockchain_bonus: Optional[float] = Field(0.0, ge=0, le=5)
    include_bonus: bool = True
    feedback: str = ""


# Elimination & Qualification Models
class EliminationDecision(BaseModel):
    team_id: str
    qualified: bool
    feedback: Optional[str] = None


class BatchQualificationUpdate(BaseModel):
    qualifications: List[EliminationDecision]


# Team Model
class TeamResponse(BaseModel):
    id: Optional[str] = None
    team_id: str
    team_name: str
    leader_name: str
    email: str
    institution: str
    members: List[str] = []
    status: TeamStatus = TeamStatus.ACTIVE
    is_qualified_r3: bool = False
    is_eliminated: bool = False
    total_score: float = 0.0
    scores_by_round: Dict[str, float] = {}
    created_at: Optional[str] = None


# Audit Log
class AuditLogModel(BaseModel):
    id: Optional[str] = None
    action: str
    actor: str
    details: Dict[str, Any] = {}
    timestamp: str
