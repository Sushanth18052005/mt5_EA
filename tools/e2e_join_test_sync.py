"""Synchronous E2E test using pymongo to verify join/switch group behavior."""
from pymongo import MongoClient
from datetime import datetime
from backend.core.config import settings
from bson.objectid import ObjectId

def main():
    uri = settings.MONGODB_URL
    dbname = settings.DATABASE_NAME
    client = MongoClient(uri)
    db = client[dbname]

    # Create first group
    g1 = {
        "group_name": f"Sync Test Group {datetime.now().strftime('%Y%m%d%H%M%S')}",
        "company_name": "Sync Test Co",
        "profit_sharing_percentage": 20,
        "settlement_cycle": "monthly",
        "grace_days": 2,
        "api_key": f"mt5_api_sync_{int(datetime.now().timestamp())}",
        "referral_code": f"REF_SYNC_{int(datetime.now().timestamp())}",
        "trading_status": "active",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    res1 = db.groups.insert_one(g1)
    gid1 = str(res1.inserted_id)
    print('Created group1', gid1, g1['api_key'])

    # Create user
    u = {
        "name": "Sync Tester",
        "email": f"sync+{int(datetime.now().timestamp())}@example.com",
        "mobile": "+19990000000",
        "password_hash": "hash",
        "role": "user",
        "status": "active",
        "ib_status": "approved",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "group_id": None,
        "group_join_date": None
    }
    ur = db.users.insert_one(u)
    uid = str(ur.inserted_id)
    print('Created user', uid)

    # Simulate join by api_key
    api_key = g1['api_key']
    group = db.groups.find_one({"api_key": api_key})
    if not group:
        print('Group not found')
        return
    db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"group_id": str(group['_id']), "group_join_date": datetime.now(), "updated_at": datetime.now()}})
    user_after = db.users.find_one({"_id": ObjectId(uid)})
    print('User after first join group_id:', user_after.get('group_id'))

    # Create second group
    g2 = {
        "group_name": f"Sync Test Group 2 {datetime.now().strftime('%Y%m%d%H%M%S')}",
        "company_name": "Sync Test Co 2",
        "profit_sharing_percentage": 25,
        "settlement_cycle": "monthly",
        "grace_days": 2,
        "api_key": f"mt5_api_sync2_{int(datetime.now().timestamp())}",
        "referral_code": f"REF_SYNC2_{int(datetime.now().timestamp())}",
        "trading_status": "active",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    res2 = db.groups.insert_one(g2)
    gid2 = str(res2.inserted_id)
    print('Created group2', gid2, g2['api_key'])

    # Simulate switching: mark previous member(s) left and unset user's group then join new
    db.members.update_many({"user_id": uid, "group_id": gid1, "status": {"$ne": "left"}}, {"$set": {"status": "left", "left_at": datetime.now()}})
    db.trading_accounts.update_many({"user_id": uid, "group_id": gid1}, {"$set": {"status": "inactive", "updated_at": datetime.now()}})
    db.users.update_one({"_id": ObjectId(uid)}, {"$unset": {"group_id": "", "group_join_date": "", "referral_code_used": ""}, "$set": {"updated_at": datetime.now()}})

    # Now join group2
    db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"group_id": gid2, "group_join_date": datetime.now(), "updated_at": datetime.now()}})
    user_after2 = db.users.find_one({"_id": ObjectId(uid)})
    print('User after switch group_id:', user_after2.get('group_id'))

    print('Done')

if __name__ == '__main__':
    main()
