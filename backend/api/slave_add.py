from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, date
from typing import Optional
import uuid

from backend.core.config import settings
from backend.utils.mongo import insert_document, fetch_documents, count_documents

router = APIRouter()


class SlaveTraderCreate(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    mobile_number: str = Field(..., min_length=6)
    status: bool = True
    start_date: date
    end_date: date
    master_id: str
    master_email: EmailStr


@router.post("/api/slave-add")
async def slave_add(request: Request, payload: SlaveTraderCreate):
    """Create a new slave trader. Validates IP, master existence, per-master slave limits, duplicates, dates and assigns MT5 path."""
    try:
        # Client IP
        client_host = request.client.host if request.client else None
        client_ip = client_host or request.headers.get('x-forwarded-for', '')

        # IP validation
        restricted = settings.RESTRICTED_IPS or ["0"]
        if not (len(restricted) == 0 or "0" in restricted):
            if client_ip not in restricted:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This IP is not allowed to access this API")

        # Date validation
        start_dt = datetime.combine(payload.start_date, datetime.min.time())
        end_dt = datetime.combine(payload.end_date, datetime.min.time())
        if end_dt < start_dt:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date cannot be before start date")

        # Verify master exists (match both id and email)
        master_res = fetch_documents(settings.DATABASE_NAME, "master_traders", {"master_id": payload.master_id, "email": payload.master_email})
        if not master_res.get("status"):
            raise HTTPException(status_code=500, detail=f"Internal server error: {master_res.get('error')}")
        if not master_res.get("data"):
            # Try matching by master_id only or email only as fallback
            master_by_id = fetch_documents(settings.DATABASE_NAME, "master_traders", {"master_id": payload.master_id})
            master_by_email = fetch_documents(settings.DATABASE_NAME, "master_traders", {"email": payload.master_email})
            if (master_by_id.get("status") and master_by_id.get("data")) or (master_by_email.get("status") and master_by_email.get("data")):
                master = (master_by_id.get("data") or master_by_email.get("data"))[0]
            else:
                raise HTTPException(status_code=400, detail="Provided slave data not found in slave trader.")
        else:
            master = master_res.get("data")[0]

        # Master-specific slave limit: ensure this master can have more slaves
        allowed_slaves = master.get("no_of_slave", 0)
        # Count existing slaves for this master
        slaves_count_res = count_documents(settings.DATABASE_NAME, "slave_traders", {"master_id": payload.master_id})
        if not slaves_count_res.get("status"):
            raise HTTPException(status_code=500, detail=f"Internal server error: {slaves_count_res.get('error')}")
        current_slave_count = slaves_count_res.get("data", 0)
        if allowed_slaves and current_slave_count >= allowed_slaves:
            raise HTTPException(status_code=400, detail="Maximum slave accounts limit reached for this master")

        # Duplicate email check across users and slave_traders
        users_res = fetch_documents(settings.DATABASE_NAME, "users", {"email": payload.email})
        if users_res.get("status") and users_res.get("data"):
            raise HTTPException(status_code=400, detail="Email already exists or failed to insert")

        slaves_res = fetch_documents(settings.DATABASE_NAME, "slave_traders", {"email": payload.email})
        if slaves_res.get("status") and slaves_res.get("data"):
            raise HTTPException(status_code=400, detail="Email already exists or failed to insert")

        # Assign MT5 path (next available)
        existing = fetch_documents(settings.DATABASE_NAME, "slave_traders", {}, sort=[("created_at", -1)])
        next_path_index = 1
        if existing.get("status") and existing.get("data"):
            paths = []
            for doc in existing.get("data"):
                p = doc.get("mt5_path")
                if p and isinstance(p, str) and p.startswith("mt5_path_"):
                    try:
                        idx = int(p.split("mt5_path_")[-1])
                        paths.append(idx)
                    except Exception:
                        continue
            if paths:
                next_path_index = max(paths) + 1

        mt5_path = f"mt5_path_{next_path_index}"

        # Prepare slave record
        slave_record = {
            "slave_id": str(uuid.uuid4()),
            "name": payload.name,
            "email": payload.email,
            "mobile_number": payload.mobile_number,
            "status": "active" if payload.status else "inactive",
            "start_date": start_dt,
            "end_date": end_dt,
            "master_id": payload.master_id,
            "master_email": payload.master_email,
            "mt5_path": mt5_path,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        ins = insert_document(settings.DATABASE_NAME, "slave_traders", slave_record)
        if not ins.get("status"):
            raise HTTPException(status_code=400, detail="Email already exists or failed to insert")

        # Log admin activity
        try:
            log = {
                "action": "slave_add",
                "details": f"Slave trader {payload.email} added under master {payload.master_email}",
                "client_ip": client_ip,
                "admin_id": 0,
                "created_at": datetime.utcnow()
            }
            insert_document(settings.DATABASE_NAME, "admin_logs", log)
        except Exception:
            pass

        return {
            "status": "success", 
            "message": f"Slave trader '{payload.name}' added successfully",
            "data": {"slave_id": slave_record["slave_id"]}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
