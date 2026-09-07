from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

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
    retrieved_chunk_citations: List[str]
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
