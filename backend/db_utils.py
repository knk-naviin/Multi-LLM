from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import HTTPException


def utc_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat()


def parse_object_id(value: Optional[str], field_name: str = "id") -> Optional[ObjectId]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    return ObjectId(value)


def serialize_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "settings": doc.get("settings", {}),
        "created_at": utc_iso(doc.get("created_at")),
    }


def serialize_project(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", "Untitled"),
        "description": doc.get("description", ""),
        "created_at": utc_iso(doc.get("created_at")),
        "updated_at": utc_iso(doc.get("updated_at")),
    }


def serialize_folder(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", "Untitled"),
        "description": doc.get("description", ""),
        "created_at": utc_iso(doc.get("created_at")),
        "updated_at": utc_iso(doc.get("updated_at")),
    }


def serialize_chat_summary(doc: Dict[str, Any]) -> Dict[str, Any]:
    messages = doc.get("messages", [])
    last_message = messages[-1]["content"] if messages else ""
    last_model = ""
    for msg in reversed(messages):
        if msg.get("role") == "assistant":
            last_model = msg.get("model_used", "")
            break

    folder_ref = doc.get("folder_id") or doc.get("project_id")
    folder_id = str(folder_ref) if folder_ref else None

    return {
        "id": str(doc["_id"]),
        "folder_id": folder_id,
        # Backward compatibility for older frontend payloads.
        "project_id": folder_id,
        "title": doc.get("title", "New Chat"),
        "last_message": last_message[:180],
        "last_model": last_model,
        "created_at": utc_iso(doc.get("created_at")),
        "updated_at": utc_iso(doc.get("updated_at")),
    }


def serialize_chat_full(doc: Dict[str, Any]) -> Dict[str, Any]:
    output_messages = []
    for msg in doc.get("messages", []):
        output_messages.append(
            {
                "role": msg.get("role"),
                "content": msg.get("content", ""),
                "model_used": msg.get("model_used"),
                "created_at": utc_iso(msg.get("created_at")),
            }
        )

    folder_ref = doc.get("folder_id") or doc.get("project_id")
    folder_id = str(folder_ref) if folder_ref else None

    return {
        "id": str(doc["_id"]),
        "folder_id": folder_id,
        # Backward compatibility for older frontend payloads.
        "project_id": folder_id,
        "title": doc.get("title", "New Chat"),
        "messages": output_messages,
        "created_at": utc_iso(doc.get("created_at")),
        "updated_at": utc_iso(doc.get("updated_at")),
    }
