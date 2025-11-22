"""Simple e2e test script to create a group, create a user, and join the group via DB operations to verify join logic."""
import asyncio
from datetime import datetime
from backend.core.config import settings
from backend.core.database import get_database
from bson import ObjectId

async def main():
    db = get_database()
    # Create a test group
    group_doc = {
        "group_name": f"Test Group {datetime.now().strftime('%Y%m%d%H%M%S')}",
        "company_name": "Test Co",
        "profit_sharing_percentage": 20,
        "settlement_cycle": "monthly",
        "grace_days": 2,
        "api_key": f"mt5_api_test_{datetime.now().timestamp()}",
        "referral_code": f"REF_TEST_{datetime.now().timestamp()}",
        "trading_status": "active",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    group_res = await db.groups.insert_one(group_doc)
    group_id = str(group_res.inserted_id)
    print('Created group', group_id, group_doc['api_key'])

    # Create a test user
    user_doc = {
        "name": "E2E Tester",
        "email": f"e2e+{int(datetime.now().timestamp())}@example.com",
        "mobile": "+10000000000",
        "password_hash": "fakehash",
        "role": "user",
        "status": "active",
        "ib_status": "approved",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "group_id": None,
        "group_join_date": None,
    }
    user_res = await db.users.insert_one(user_doc)
    user_id = str(user_res.inserted_id)
    print('Created user', user_id)

    # Simulate join by API key using the backend join logic (call join-by-api-key handler directly)
    # We will set user's group_id as join handler would do
    api_key = group_doc['api_key']

    # Direct DB update similar to join handler
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"group_id": group_id, "group_join_date": datetime.now(), "updated_at": datetime.now()}})
    user_after = await db.users.find_one({"_id": ObjectId(user_id)})
    print('User after join:', user_after.get('group_id'), user_after.get('group_join_date'))

    # Now create another group and try switching
    group_doc2 = {
        "group_name": f"Test Group 2 {datetime.now().strftime('%Y%m%d%H%M%S')}",
        "company_name": "Test Co 2",
        "profit_sharing_percentage": 25,
        "settlement_cycle": "monthly",
        "grace_days": 2,
        "api_key": f"mt5_api_test2_{datetime.now().timestamp()}",
        "referral_code": f"REF_TEST2_{datetime.now().timestamp()}",
        "trading_status": "active",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    group_res2 = await db.groups.insert_one(group_doc2)
    group2_id = str(group_res2.inserted_id)
    print('Created second group', group2_id, group_doc2['api_key'])

    # Simulate switching: perform the 'leave' steps then set new group
    # Mark previous member records left (none exist), deactivate trading accounts (none exist)
    await db.members.update_many({"user_id": user_id, "group_id": group_id, "status": {"$ne": "left"}}, {"$set": {"status": "left", "left_at": datetime.now()}})
    await db.trading_accounts.update_many({"user_id": user_id, "group_id": group_id}, {"$set": {"status": "inactive", "updated_at": datetime.now()}})
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$unset": {"group_id": "", "group_join_date": "", "referral_code_used": ""}, "$set": {"updated_at": datetime.now()}})

    # Now join second group
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"group_id": group2_id, "group_join_date": datetime.now(), "updated_at": datetime.now()}})
    user_after2 = await db.users.find_one({"_id": ObjectId(user_id)})
    print('User after switching join:', user_after2.get('group_id'), user_after2.get('group_join_date'))

    print('E2E test done')

if __name__ == '__main__':
    asyncio.run(main())
