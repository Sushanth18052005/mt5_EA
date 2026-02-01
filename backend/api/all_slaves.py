from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from typing import Optional

from backend.core.config import settings
from backend.utils.mongo import fetch_documents, insert_document
from backend.services.user_service import user_service
from backend.api.admin import verify_admin
from backend.models.common import APIResponse

router = APIRouter()


@router.get("/api/all-slaves", response_model=APIResponse)
async def get_all_slaves(
    request: Request,
    role: Optional[str] = Query(None, description="Filter by role (e.g., member)"),
    status: Optional[str] = Query(None, description="Filter by user status"),
    admin_user = Depends(verify_admin)
):
    """Return list of users (slave traders). Admin only."""

    try:
        # Resolve client IP
        client_host = request.client.host if request.client else None
        client_ip = client_host or request.headers.get('x-forwarded-for', '')

        # IP validation
        restricted = settings.RESTRICTED_IPS or ["0"]
        if not (len(restricted) == 0 or "0" in restricted):
            if client_ip not in restricted:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This IP is not allowed to access this API")
        # Query slave_traders collection
        query = {}
        if status:
            query["status"] = status

        result = fetch_documents(
            settings.DATABASE_NAME,
            "slave_traders",
            query,
            sort=[("created_at", -1)]
        )

        if not result["status"]:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("error", "DB error"))

        users = result.get("data", [])

        # No cleaning needed for now, or implement slave specific cleaning
        cleaned = users

        # Log admin access (admin_id=0 for system-level)
        try:
            log = {
                "admin_id": 0,
                "action": "fetch_all_slaves",
                "entity": "users",
                "client_ip": client_ip,
                "details": {"count": len(cleaned)}
            }
            insert_document(settings.DATABASE_NAME, "admin_logs", log)
        except Exception:
            pass

        return APIResponse(success=True, message="Slave users retrieved", data=cleaned)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
