import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    agent_sessions = relationship("AgentSession", back_populates="workspace", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    classification = Column(String, nullable=False)
    chunk_count = Column(Integer, default=0)
    status = Column(String, nullable=False, default="queued")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)
    raw_content = Column(Text, nullable=False)
    vector_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="chunks")


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id = Column(String, primary_key=True, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="agent_sessions")
    audit_logs = relationship("AuditLog", back_populates="session", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("agent_sessions.id"), nullable=True, index=True)
    prompt_hash = Column(String, nullable=False)
    tools_called = Column(Text, nullable=False)  # JSON-encoded array or comma-separated
    citations = Column(Text, nullable=False)     # JSON-encoded array or text
    egress_bytes = Column(Integer, default=0)
    execution_duration_ms = Column(Integer, nullable=False)
    compliance_status = Column(String, default="AIR_GAP_PASSED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("AgentSession", back_populates="audit_logs")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="AI Researcher")
    avatar_letter = Column(String, nullable=False, default="U")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    chat_sessions = relationship("DBChatSession", back_populates="user", cascade="all, delete-orphan")


class DBChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    workspace_id = Column(String, default="default_workspace")
    title = Column(String, nullable=False)
    preview = Column(Text, default="")
    model = Column(String, default="llama3.1:8b")
    is_pinned = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("DBChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="DBChatMessage.created_at")


class DBChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String, nullable=False)  # 'user' | 'model'
    text = Column(Text, nullable=False)
    timestamp_label = Column(String, nullable=True)
    model_used = Column(String, nullable=True)
    model_capability = Column(String, nullable=True)
    routing_reason = Column(String, nullable=True)
    thinking_duration = Column(String, nullable=True)
    thinking_steps = Column(Text, nullable=True)  # JSON-encoded array
    artifact = Column(Text, nullable=True)        # JSON-encoded ArtifactData
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("DBChatSession", back_populates="messages")

