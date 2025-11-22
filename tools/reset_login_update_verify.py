"""Reset admin@test.com password via public endpoint, login, update profile, and verify DB change.

Run: python tools\reset_login_update_verify.py
"""
import requests
import asyncio
from backend.services.mongodb_service import mongodb_service

API_URL = 'http://localhost:8000'
email = 'admin@test.com'
new_password = 'Admin123!'

def reset_password():
    print('Resetting password for', email)
    resp = requests.post(f'{API_URL}/api/v1/auth/admin-reset-password', json={'email': email, 'new_password': new_password})
    print('Reset status:', resp.status_code)
    try:
        print(resp.json())
    except Exception:
        print(resp.text)
    return resp.ok

def login_and_update():
    print('Logging in')
    resp = requests.post(f'{API_URL}/api/v1/auth/login', json={'mobile_or_email': email, 'password': new_password})
    print('Login status:', resp.status_code)
    try:
        print(resp.json())
    except Exception:
        print(resp.text)
    if not resp.ok:
        return None
    data = resp.json().get('data', {})
    token = data.get('access_token') or data.get('accessToken') or (data.get('access_token') if isinstance(data, dict) else None)
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    update_payload = {'name': 'Admin Updated HTTP', 'country': 'India', 'state': 'Karnataka'}
    r2 = requests.put(f'{API_URL}/api/v1/users/profile', json=update_payload, headers=headers)
    print('Update profile status:', r2.status_code)
    try:
        print(r2.json())
    except Exception:
        print(r2.text)
    return True

async def verify_db():
    print('Verifying DB record via mongodb_service.get_user_by_email')
    res = await mongodb_service.get_user_by_email(email)
    print('Result:', res)

if __name__ == '__main__':
    ok = reset_password()
    if ok:
        if login_and_update():
            asyncio.run(verify_db())
    else:
        print('Reset failed; aborting')
