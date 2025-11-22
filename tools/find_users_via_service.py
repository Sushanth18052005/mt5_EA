"""Async diagnostic script that uses backend.services.mongodb_service to find users.

Run from project root: python tools\find_users_via_service.py
"""
import asyncio
from backend.services.mongodb_service import mongodb_service

async def main():
    print('Testing get_user_by_email for admin@test.com')
    user = await mongodb_service.get_user_by_email('admin@test.com')
    print('admin@test.com ->', user)

    print('\nTesting get_all_users and searching for testapi+')
    all_res = await mongodb_service.get_all_users()
    if all_res['status']:
        users = all_res['data']
        matches = [u for u in users if u.get('email', '').startswith('testapi+')]
        print(f'Found {len(matches)} users starting with testapi+')
        for m in matches[:10]:
            print({k: m.get(k) for k in ['id','name','email','status','created_at']})
    else:
        print('Failed to get all users:', all_res)

if __name__ == '__main__':
    asyncio.run(main())
