from fastapi import APIRouter, Request, HTTPException, status, Depends
from pydantic import BaseModel, Field
from backend.core.config import settings
from backend.utils.mongo import fetch_documents, delete_document, insert_document
from datetime import datetime
from zoneinfo import ZoneInfo
from backend.api.admin import verify_admin

router = APIRouter()


class DeleteSlaveRequest(BaseModel):
    slave_id: int = Field(..., gt=0, description="Unique identifier of the slave trader to delete")


@router.delete("/api/slave-delete")
async def slave_delete(request: Request, payload: DeleteSlaveRequest, admin_user = Depends(verify_admin)):
    """Delete a slave trader by slave_id (admin-only). Logs the deletion action."""
    try:
        # Resolve client IP
        client_host = request.client.host if request.client else None
        client_ip = client_host or request.headers.get('x-forwarded-for', '')

        # Basic validation already handled by Pydantic (gt=0)
        slave_id = payload.slave_id

        # Verify slave exists
        found = fetch_documents(settings.DATABASE_NAME, "slave_traders", {"slave_id": slave_id})
        if not found.get("status"):
            raise HTTPException(status_code=500, detail="Internal server error: failed to query database")
        if not found.get("data"):
            raise HTTPException(status_code=404, detail=f"No slave trader found with trade_id {slave_id}")

        # Perform deletion
        del_res = delete_document(settings.DATABASE_NAME, "slave_traders", {"slave_id": slave_id})
        if not del_res.get("status"):
            raise HTTPException(status_code=500, detail=f"Internal server error: {del_res.get('error')}")

        deleted_info = del_res.get("data", "")
        if "Deleted 0" in deleted_info:
            raise HTTPException(status_code=404, detail=f"No slave trader found with trade_id {slave_id}")

        # Log deletion (admin id from verify_admin)
        try:
            tz = ZoneInfo("Asia/Kolkata")
            admin_id = admin_user.get("user_id") if isinstance(admin_user, dict) else 0
            log = {
                "admin_id": admin_id,
                "action": "slave_delete",
                "entity": "slave_traders",
                "entity_id": slave_id,
                "client_ip": client_ip,
                "details": {"deleted_info": deleted_info},
                "update_time": datetime.now(tz).isoformat()
            }
            insert_document(settings.DATABASE_NAME, "admin_logs", log)
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"Master trader with trade_id {slave_id} deleted successfully",
            "requested_by_ip": client_ip
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
