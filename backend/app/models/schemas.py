from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict, Union

# Workspace Models
class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str

# Document Ingestion Models
class DocumentUploadResponse(BaseModel):
    document_id: str
    workspace_id: str
    filename: str
    file_size_bytes: int
    status: str
    estimated_chunks: int
    created_at: str

class DocumentStatusResponse(BaseModel):
    document_id: str
    workspace_id: str
    status: str
    total_pages: int
    total_chunks: int
    embedding_model: str
    vector_dimensions: int
    completed_at: Optional[str] = None

class DocumentItem(BaseModel):
    id: str
    workspace_id: str
    filename: str
    filepath: str
    file_type: str
    classification: str
    chunk_count: int
    status: str
    created_at: str

class DocumentContentResponse(BaseModel):
    document_id: str
    workspace_id: str
    filename: str
    file_type: str
    content: str
    chunk_count: int
    status: str

class DocumentUpdateRequest(BaseModel):
    content: str
    filename: Optional[str] = None
    classification: Optional[str] = None

# WebSocket Agent Execution Models
class AgentRunRequest(BaseModel):
    action: str = "run_agent"
    workspace_id: str
    prompt: str
    active_document_ids: List[str] = Field(default_factory=list)
    allowed_tools: List[str] = Field(default_factory=list)
    temperature: float = 0.2

class ChunkCitation(BaseModel):
    document_id: str
    chunk_id: str
    page_number: int
    snippet: str
    content: Optional[str] = None

class AgentFinalResponse(BaseModel):
    event: str = "final_answer"
    step: int
    content: str
    citations: List[ChunkCitation] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)

# Vision Pipeline Models
class VisionAnalysisRequest(BaseModel):
    workspace_id: str
    image_path: str
    prompt: str
    confidence_threshold: float = 0.70

class DetectedElement(BaseModel):
    element_id: str
    label: str
    tag_code: Optional[str] = None
    bounding_box_2d: List[int]  # [ymin, xmin, ymax, xmax]
    confidence: float

class ImageDimensions(BaseModel):
    width: int
    height: int

class VisionAnalysisResponse(BaseModel):
    model: str
    detected_elements: List[DetectedElement]
    image_dimensions: ImageDimensions
    processing_time_ms: int

# Sandbox Execution Models
class SandboxExecuteRequest(BaseModel):
    code: str
    language: str = "python"
    stdin: Optional[str] = None
    timeout_seconds: int = 10
    memory_limit_mb: int = 512

class GeneratedArtifact(BaseModel):
    filename: str
    download_url: str

class SandboxExecuteResponse(BaseModel):
    exit_code: int
    stdout: str
    stderr: str
    execution_time_ms: int
    generated_artifacts: List[GeneratedArtifact]
    limits_exceeded: bool

# Audit Models
class AuditTraceRecord(BaseModel):
    trace_id: str
    session_id: Optional[str] = None
    timestamp: str
    user_prompt_hash: str
    tools_invoked: List[str]
    retrieved_chunk_citations: List[Union[str, Dict[str, Any]]]
    external_egress_bytes: int = 0
    compliance_status: str = "AIR_GAP_PASSED"

class AuditTracesResponse(BaseModel):
    total_records: int
    records: List[AuditTraceRecord]

# System Telemetry Models
class NetworkIsolationTelemetry(BaseModel):
    air_gap_active: bool = True
    external_interfaces_active: bool = False
    bytes_sent_external: int = 0

class GpuTelemetry(BaseModel):
    device_name: str = "Host Compute / CPU Fallback"
    total_vram_mb: int = 0
    allocated_vram_mb: int = 0
    free_vram_mb: int = 0

class LoadedModelInfo(BaseModel):
    name: str
    role: str
    engine: str
    status: str

class SystemHealthResponse(BaseModel):
    gateway_status: str
    timestamp: str
    network_isolation: NetworkIsolationTelemetry
    gpu_telemetry: GpuTelemetry
    loaded_models: List[LoadedModelInfo]
    ollama_endpoint: str = ""
    ollama_running: bool = False
    available_models: List[str] = []

# User Authentication Schemas
class UserRegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: Optional[str] = "AI Researcher"
    avatar_letter: Optional[str] = None

class UserLoginRequest(BaseModel):
    username: str
    password: str

class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: str
    avatar_letter: str
    created_at: str

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse

# Chat Persistence Schemas
class ChatMessagePayload(BaseModel):
    id: Optional[str] = None
    sender: str  # 'user' | 'model'
    text: str
    timestamp: Optional[str] = None
    modelUsed: Optional[str] = None
    modelCapability: Optional[str] = None
    routingReason: Optional[str] = None
    thinkingDuration: Optional[str] = None
    thinkingSteps: Optional[List[str]] = None
    artifact: Optional[Dict[str, Any]] = None

class ChatSessionCreateRequest(BaseModel):
    id: Optional[str] = None
    title: str
    preview: Optional[str] = ""
    model: Optional[str] = "llama3.1:8b"
    is_pinned: Optional[bool] = False
    workspace_id: Optional[str] = "default_workspace"

class ChatSessionUpdateRequest(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None
    preview: Optional[str] = None

class ChatSessionSummaryResponse(BaseModel):
    id: str
    title: str
    preview: str
    timestamp: str
    model: str
    isPinned: bool
    messageCount: int
    path: str
    workspace_id: str
    created_at: str

class ChatSessionDetailResponse(BaseModel):
    id: str
    title: str
    preview: str
    timestamp: str
    model: str
    isPinned: bool
    messageCount: int
    path: str
    workspace_id: str
    messages: List[ChatMessagePayload]
    created_at: str

# Multi-Format Document Compilation & Hardware Telemetry Schemas
class DocumentCompileRequest(BaseModel):
    title: str
    content: str
    format: str = "pdf"  # "pdf" | "docx" | "latex" | "html" | "all"
    author_name: Optional[str] = "Lead AI Architect"
    author_title: Optional[str] = "Lead Operations Engineer"
    citations: Optional[List[Dict[str, Any]]] = None

class DocumentCompileResponse(BaseModel):
    title: str
    format: str
    filename: Optional[str] = None
    download_url: Optional[str] = None
    file_path: Optional[str] = None
    formats: Optional[Dict[str, Any]] = None

class SessionBundleResponse(BaseModel):
    session_id: str
    zip_filename: str
    download_url: str
    file_path: str


# Computer Vision Worker Models (Phase 1A / Phase 1B Contract)
class CVTextBlock(BaseModel):
    block_id: str
    text: str
    confidence: float
    bounding_box_2d: List[int]  # [ymin, xmin, ymax, xmax]


class CVPageResult(BaseModel):
    page_number: int
    width: int
    height: int
    text_blocks: List[CVTextBlock] = Field(default_factory=list)
    tables: List[Dict[str, Any]] = Field(default_factory=list)


class CVRunnerResponse(BaseModel):
    status: str  # "success" | "error"
    processing_time_ms: int
    total_pages: int
    pages: List[CVPageResult] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


