"""Quick test: login as demo admin and update profile against local backend

Run: python tools\http_quick_update_admin.py
"""
import requests

API_URL = 'http://localhost:8000'

email = 'admin@test.com'
password = 'admin123'

print('Logging in as', email)
resp = requests.post(f'{API_URL}/api/v1/auth/login', json={'mobile_or_email': email, 'password': password})
print('Login status:', resp.status_code)
try:
    print(resp.json())
except Exception:
    print(resp.text)

if resp.ok:
    data = resp.json().get('data', {})
    token = data.get('access_token') or data.get('accessToken') or (data.get('access_token') if isinstance(data, dict) else None)
    if not token:
        # handle older response shape
        token = data.get('access_token') if isinstance(data, dict) else None

    print('Token present:', bool(token))
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    update_payload = {'name': 'Admin Updated', 'country': 'India', 'state': 'Karnataka'}
    r2 = requests.put(f'{API_URL}/api/v1/users/profile', json=update_payload, headers=headers)
    print('Update profile status:', r2.status_code)
    try:
        print(r2.json())
    except Exception:
        print(r2.text)
else:
    print('Admin login failed; cannot test update')
