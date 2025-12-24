from fastapi import APIRouter, Request, HTTPException, status, Depends
from pydantic import BaseModel, Field
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.core.config import settings
from backend.utils.mongo import update_document, insert_document, fetch_documents
from backend.api.admin import verify_admin

router = APIRouter()


class LogInSlaveRequest(BaseModel):
    slave_id: int = Field(..., description="Unique identifier for the slave trader")
    mt_account_no: int = Field(..., description="MT5 account number")
    mt_password: str = Field(..., description="MT5 account password")
    mt_server: str = Field(..., description="MT5 server name or address")


@router.post("/api/slave-login")
async def slave_login(request: Request, payload: LogInSlaveRequest, admin_user = Depends(verify_admin)):
    """Update a slave trader's MT5 login credentials and clear irrelevant MT5 fields.

    Requires admin authentication (verify_admin). Logs the update in `admin_logs`.
    """
    try:
        # Resolve client IP
        client_host = request.client.host if request.client else None
        client_ip = client_host or request.headers.get('x-forwarded-for', '')

        # Ensure slave exists
        existing = fetch_documents(settings.DATABASE_NAME, "slave_traders", {"slave_id": payload.slave_id}, limit=1)
        if not existing.get("status"):
            raise HTTPException(status_code=500, detail=f"Internal server error: {existing.get('error')}")
        if not existing.get("data"):
            raise HTTPException(status_code=400, detail="Slave trader not found")

        # Prepare update fields
        mt_login = {
            "server": payload.mt_server,
            "account": payload.mt_account_no,
            "password": payload.mt_password
        }

        # Fields to clear
        clear_fields = {
            "account_name": "__CLEAR__",
            "balance": "__CLEAR__",
            "equity": "__CLEAR__",
            "margin": "__CLEAR__",
            "margin_level": "__CLEAR__",
            "profit": "__CLEAR__",
            "free_margin": "__CLEAR__",
            "last_trade_time": "__CLEAR__"
        }

        update_data = {
            "mt5_login": mt_login,
            "mt_account_no": payload.mt_account_no,
            **clear_fields,
            "updated_at": datetime.utcnow()
        }

        # Update DB
        res = update_document(settings.DATABASE_NAME, "slave_traders", "slave_id", payload.slave_id, update_data)
        if not res.get("status"):
            raise HTTPException(status_code=400, detail="Failed to update MT5 login data")

        # Log admin activity
        try:
            tz = ZoneInfo("Asia/Kolkata")
            admin_id = admin_user.get("user_id") if isinstance(admin_user, dict) else 0
            log = {
                "admin_id": admin_id,
                "action": "slave_login_update",
                "entity": "slave_traders",
                "entity_id": payload.slave_id,
                "client_ip": client_ip,
                "details": {
                    "account_no": payload.mt_account_no,
                    "server": payload.mt_server
                },
                "update_time": datetime.now(tz).isoformat()
            }
            insert_document(settings.DATABASE_NAME, "admin_logs", log)
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"MT5 login updated for trade_id={payload.slave_id}",
            "data": {"trade_id": payload.slave_id, "account_no": payload.mt_account_no, "server": payload.mt_server}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
