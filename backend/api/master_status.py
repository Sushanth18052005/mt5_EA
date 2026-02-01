from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel, Field
from backend.core.config import settings
from backend.utils.mongo import update_document, insert_document
from datetime import datetime
from zoneinfo import ZoneInfo

router = APIRouter()


class StatusMasterRequest(BaseModel):
    trade_id: str = Field(..., description="Unique identifier for the master trader")
    status: bool = Field(..., description="Master status (true = active, false = inactive)")


@router.post("/api/master-status")
async def master_status(request: Request, payload: StatusMasterRequest):
    """Update master trader active/inactive status (IP-restricted).

    Logs the change and returns structured response.
    """
    try:
        # Resolve client IP
        client_host = request.client.host if request.client else None
        client_ip = client_host or request.headers.get('x-forwarded-for', '')

        # IP validation
        restricted = settings.RESTRICTED_IPS or ["0"]
        if not (len(restricted) == 0 or "0" in restricted):
            if client_ip not in restricted:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This IP is not allowed to access this API")

        # Map boolean status to stored value
        stored_status = "active" if payload.status else "inactive"

        # Prepare update data
        update_data = {
            "status": stored_status,
            "updated_at": datetime.utcnow()
        }

        # Update by trade_id
        res = update_document(settings.DATABASE_NAME, "master_traders", "trade_id", payload.trade_id, update_data)
        if not res.get("status"):
            raise HTTPException(status_code=400, detail="Failed to update Master Status data")

        # Log action (admin_id=0)
        try:
            tz = ZoneInfo("Asia/Kolkata")
            log = {
                "admin_id": 0,
                "action": "master_status_update",
                "entity": "master_traders",
                "entity_id": payload.trade_id,
                "client_ip": client_ip,
                "details": {"status": stored_status},
                "update_time": datetime.now(tz).isoformat()
            }
            insert_document(settings.DATABASE_NAME, "admin_logs", log)
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"Master Status trade_id={payload.trade_id}",
            "data": {"trade_id": payload.trade_id, "status": payload.status}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
