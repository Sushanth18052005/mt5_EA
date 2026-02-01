
import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.database import connect_to_mongo
from backend.services.mongodb_service import mongodb_service
from backend.models.database_models import User

async def reset_admin():
    print("🔄 Connecting to MongoDB...")
    await connect_to_mongo()
    
    email = "admin@4xengineer.com"
    new_password = "admin123"
    
    print(f"🔄 Resetting password for {email} to {new_password}...")
    
    db = mongodb_service.get_db()
    hashed = mongodb_service._hash_password(new_password)
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {
            "password_hash": hashed, 
            "role": "admin", 
            "status": "active"
        }}
    )
    
    if result.matched_count > 0:
        print("✅ Password reset successful!")
    else:
        print("❌ User not found, creating new admin...")
        user_data = {
            "name": "Test Admin",
            "email": email,
            "password": new_password,
            "mobile": "+9999999999",
            "role": "admin",
            "country": "Test",
            "state": "Test",
            "city": "Test",
            "pin_code": "000000"
        }
        await mongodb_service.create_user(user_data)
        # Force activate
        await db.users.update_one(
            {"email": email},
            {"$set": {"status": "active", "mobile_verified": True, "email_verified": True}}
        )
        print("✅ New admin created!")

if __name__ == "__main__":
    asyncio.run(reset_admin())
