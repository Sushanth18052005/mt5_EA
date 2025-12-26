from fastapi import APIRouter, HTTPException, status, Depends, Request
from backend.core.config import settings
from backend.utils.mongo import fetch_documents, insert_document
from backend.models.common import APIResponse

# Import admin verify dependency
from backend.api.admin import verify_admin

router = APIRouter()


@router.get("/api/all-masters", response_model=APIResponse)
async def get_all_masters(request: Request, admin_user = Depends(verify_admin)):
    """Return all master traders (admin only). Tries `master_traders` then `master_accounts`.

    Performs client IP validation against `settings.RESTRICTED_IPS` and logs the access.
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

        # Try master_traders collection first
        res = fetch_documents(settings.DATABASE_NAME, "master_traders", {}, sort=[("created_at", -1)])
        masters = []
        if res.get("status") and res.get("data"):
            masters = res.get("data")
        else:
            # Fallback to master_accounts collection
            res2 = fetch_documents(settings.DATABASE_NAME, "master_accounts", {}, sort=[("created_at", -1)])
            if res2.get("status"):
                masters = res2.get("data")

        # Strip sensitive fields before returning
        safe_masters = []
        for m in masters:
            safe = m.copy()
            for sensitive in ("password", "trading_password_hash", "api_key", "secret"):
                if sensitive in safe:
                    safe.pop(sensitive, None)
            safe_masters.append(safe)

        # Log admin access (admin_id=0 for system-level requests)
        try:
            log = {
                "admin_id": 0,
                "action": "fetch_all_masters",
                "entity": "master_traders",
                "client_ip": client_ip,
                "details": {"count": len(safe_masters)}
            }
            insert_document(settings.DATABASE_NAME, "admin_logs", log)
        except Exception:
            pass

        return APIResponse(success=True, message="Master traders retrieved", data={"masters": safe_masters})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
