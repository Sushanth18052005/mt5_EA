from fastapi import APIRouter, Request, HTTPException, status, Depends
from pydantic import BaseModel, Field
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.core.config import settings
from backend.utils.mongo import update_document, insert_document
from backend.api.admin import verify_admin

router = APIRouter()


class StatusSlaveRequest(BaseModel):
    slave_id: int = Field(..., description="Unique identifier of the slave trader")
    status: bool = Field(..., description="Slave status (true = active, false = inactive)")


@router.post("/api/slave-status")
async def slave_status(request: Request, payload: StatusSlaveRequest, admin_user = Depends(verify_admin)):
    """Update slave trader active/inactive status (admin-only + optional IP restriction).

    Logs the change and returns a structured response.
    """
    try:
        # Resolve client IP
        client_host = request.client.host if request.client else None
        client_ip = client_host or request.headers.get('x-forwarded-for', '')

        # IP validation (optional extra safeguard)
        restricted = settings.RESTRICTED_IPS or ["0"]
        if not (len(restricted) == 0 or "0" in restricted):
            if client_ip not in restricted:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This request is not allowed")

        # Map boolean to stored string status
        stored_status = "active" if payload.status else "inactive"

        update_data = {
            "status": stored_status,
            "updated_at": datetime.utcnow()
        }

        # Update DB by slave_id
        res = update_document(settings.DATABASE_NAME, "slave_traders", "slave_id", payload.slave_id, update_data)
        if not res.get("status"):
            raise HTTPException(status_code=400, detail="Failed to update slave Status data")

        # Log action with admin id and Asia/Kolkata timezone
        try:
            tz = ZoneInfo("Asia/Kolkata")
            admin_id = admin_user.get("user_id") if isinstance(admin_user, dict) else 0
            log = {
                "admin_id": admin_id,
                "action": "slave_status_update",
                "entity": "slave_traders",
                "entity_id": payload.slave_id,
                "client_ip": client_ip,
                "details": {"status": stored_status},
                "update_time": datetime.now(tz).isoformat()
            }
            insert_document(settings.DATABASE_NAME, "admin_logs", log)
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"slave Status slave={payload.slave_id}",
            "data": {"slave_id": payload.slave_id, "status": payload.status}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
