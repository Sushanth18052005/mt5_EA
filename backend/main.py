# ===================================
# main.py - Updated with ALL routers
# ===================================
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
from backend.core.config import settings
from backend.core.database import connect_to_mongo, close_mongo_connection

# Import ALL routers
from backend.api import (
    auth,
    users,          # NOW ADDED
    groups,
    members,
    settlements,
    reports,
    admin,
    admin_simple,   # NEW: Simple working admin endpoints
    support,        # NOW ADDED
    notifications,  # NOW ADDED
    master_accounts, # NOW ADDED
    registration,   # NEW: Registration flow
    user_panel,     # NEW: User panel endpoints
    group_panel,     # NEW: Group panel endpoints
    realtime        # NEW: Real-time SSE endpoints
    ,
    master_add,     # NEW: Add master trader endpoint
    master_login,   # NEW: Master login endpoint
    master_status,  # NEW: Master status endpoint
    master_delete,  # NEW: Master delete endpoint
    all_masters     # NEW: All masters listing endpoint
)
from backend.api import all_slaves
from backend.api import slave_add

# Initialize security
security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    # Avoid printing emojis which can cause UnicodeEncodeError on some Windows consoles
    print("MT5 Copy Trading API Started")
    yield
    # Shutdown
    await close_mongo_connection()
    print("MT5 Copy Trading API Stopped")

# Create FastAPI app
app = FastAPI(
    title="MT5 Copy Trading Management System",
    description="Complete business management backend for MT5 copy trading platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Add CORS middleware
allowed_origins = [
    "http://localhost:3000",
    "https://localhost:3000",
    "https://*.vercel.app",
    "https://*.onrender.com",
    "*"  # Allow all for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ALL routers with proper prefixes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["Groups"])
app.include_router(members.router, prefix="/api/v1/members", tags=["Members"])
app.include_router(settlements.router, prefix="/api/v1/settlements", tags=["Settlements"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(admin_simple.router, prefix="/api/v1/admin-simple", tags=["Admin Simple"])
app.include_router(support.router, prefix="/api/v1/support", tags=["Support"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(master_accounts.router, prefix="/api/v1/master-accounts", tags=["Master Accounts"])
app.include_router(master_add.router, tags=["Master Add"])
app.include_router(all_masters.router, tags=["All Masters"])
app.include_router(master_login.router, tags=["Master Login"])
app.include_router(master_delete.router, tags=["Master Delete"])  # NEW: Master delete endpoint
app.include_router(master_status.router, tags=["Master Status"])
app.include_router(all_slaves.router, tags=["All Slaves"])
app.include_router(slave_add.router, tags=["Slave Add"])
app.include_router(registration.router, tags=["Registration"])
app.include_router(user_panel.router, tags=["User Panel"])
app.include_router(group_panel.router, tags=["Group Panel"])
app.include_router(realtime.router, prefix="/api/v1/realtime", tags=["Real-time"])

@app.get("/")
async def root():
    return {
        "message": "MT5 Copy Trading Management API", 
        "version": "1.0.0",
        "status": "ready",
        "docs": "/api/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "mt5-copy-trading-backend",
        "database": "connected"
    }

@app.get("/api/endpoints")
async def list_endpoints():
    """List all available API endpoints"""
    endpoints = []
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            endpoints.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name
            })
    
    return {
        "total_endpoints": len(endpoints),
        "endpoints": sorted(endpoints, key=lambda x: x["path"]),
        "api_documentation": "/api/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True if settings.DEBUG else False,
        workers=1
    )