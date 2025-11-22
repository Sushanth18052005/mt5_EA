"""Connect to MongoDB via project's connect_to_mongo and list users for diagnosis.

Run: python tools\connect_and_find_users.py
"""
import asyncio
from backend.core.database import connect_to_mongo, get_database, close_mongo_connection
from backend.services.mongodb_service import mongodb_service

async def main():
    await connect_to_mongo()
    db = get_database()
    if db is None:
        print('DB not available after connect_to_mongo()')
        return

    print('DB available. Counting users...')
    count = await db.users.count_documents({})
    print('Users count:', count)

    print('\nLooking for admin@test.com')
    admin = await db.users.find_one({'email': 'admin@test.com'})
    print('admin@test.com ->', None if not admin else {
        'id': str(admin.get('_id')),
        'user_id': admin.get('user_id'),
        'email': admin.get('email'),
        'status': admin.get('status'),
        'ib_status': admin.get('ib_status')
    })

    print('\nLooking for any user with email starting testapi+')
    cursor = db.users.find({'email': {'$regex': '^testapi\+'}}).limit(10)
    docs = await cursor.to_list(length=10)
    print('Found', len(docs))
    for d in docs:
        print({
            'id': str(d.get('_id')),
            'user_id': d.get('user_id'),
            'email': d.get('email'),
            'status': d.get('status')
        })

    await close_mongo_connection()

if __name__ == '__main__':
    asyncio.run(main())
