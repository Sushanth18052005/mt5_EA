"""Activate a specific test user by _id, then login and update profile via HTTP to verify persistence."""
import asyncio
from bson import ObjectId
from backend.core.database import connect_to_mongo, get_database, close_mongo_connection
import requests

# Update this _id if different; this is the one we found in previous run
TEST_USER_OID = '68ed3a2ce450bb49229e9141'
API_URL = 'http://localhost:8000'

async def activate_user():
    await connect_to_mongo()
    db = get_database()
    if db is None:
        print('DB connection failed')
        return False

    oid = ObjectId(TEST_USER_OID)
    print('Setting ib_status=approved and status=active for user', TEST_USER_OID)
    result = await db.users.update_one({'_id': oid}, {'$set': {'ib_status': 'approved', 'status': 'active', 'updated_at': __import__('datetime').datetime.now()}})
    print('Modified count:', getattr(result, 'modified_count', None))
    await close_mongo_connection()
    return True

def login_and_update():
    # Need to find the user's email from DB to login - we know it from previous run
    email = 'testapi+1760377388@example.com'
    password = 'Testpass123!'

    print('Logging in as', email)
    resp = requests.post(f'{API_URL}/api/v1/auth/login', json={'mobile_or_email': email, 'password': password})
    print('Login status:', resp.status_code)
    try:
        print(resp.json())
    except Exception:
        print(resp.text)
    if not resp.ok:
        return False

    data = resp.json().get('data', {})
    token = data.get('access_token') or data.get('accessToken') or (data.get('access_token') if isinstance(data, dict) else None)
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    print('Updating profile via API')
    update_payload = {'name': 'HTTP Test Updated', 'country': 'India', 'state': 'Karnataka'}
    r2 = requests.put(f'{API_URL}/api/v1/users/profile', json=update_payload, headers=headers)
    print('Update status:', r2.status_code)
    try:
        print(r2.json())
    except Exception:
        print(r2.text)

    return True

if __name__ == '__main__':
    ok = asyncio.run(activate_user())
    if ok:
        print('Activation attempted; now trying login/update')
        login_and_update()
    else:
        print('Activation failed')
