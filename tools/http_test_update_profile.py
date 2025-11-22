"""Script to register a test user, login, and call update profile endpoint to verify end-to-end HTTP flow.

Usage: run from project root. Set API_URL environment variable to point to a different server (e.g. http://localhost:8000).
"""
import os
import requests
from datetime import datetime

API_URL = os.environ.get('API_URL', 'https://mt5-copytrade.onrender.com')

email = f'testapi+{int(datetime.now().timestamp())}@example.com'
password = 'Testpass123!'

# 1) Register
reg_payload = {
    'name': 'HTTP Test User',
    'mobile': '+19999999999',
    'email': email,
    'country': 'United States',
    'state': 'CA',
    'city': 'San Francisco',
    'pin_code': '94105',
    # required by registration validation
    'broker': 'TestBroker',
    'account_no': 'ACC123456',
    'trading_password': 'tradepass',
    'password': password
}

print('Registering user', email)
resp = requests.post(f'{API_URL}/api/v1/auth/register', json=reg_payload)
print('Register:', resp.status_code)
try:
    print(resp.json())
except Exception:
    print(resp.text)

# 2) Login
login_payload = {'mobile_or_email': email, 'password': password}
print('Logging in')
resp = requests.post(f'{API_URL}/api/v1/auth/login', json=login_payload)
print('Login:', resp.status_code)
try:
    print(resp.json())
except Exception:
    print(resp.text)

if resp.ok:
    data = resp.json().get('data', {})
    token = data.get('access_token') or data.get('accessToken')
    print('Token present:', bool(token))

    # 3) Update profile
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    update_payload = {'name': 'HTTP Updated Name', 'country': 'India', 'state': 'Karnataka'}
    r2 = requests.put(f'{API_URL}/api/v1/users/profile', json=update_payload, headers=headers)
    print('Update profile:', r2.status_code)
    try:
        print(r2.json())
    except Exception:
        print(r2.text)
else:
    # If account not active, try to bootstrap admin and activate user
    try:
        body = resp.json()
        detail = body.get('detail')
    except Exception:
        detail = None

    print('Login failed with detail:', detail)

    if detail and ('not active' in str(detail).lower() or 'pending' in str(detail).lower()):
        print('Attempting to bootstrap admin and activate the user...')

        # 1) Bootstrap admin (may fail if admin exists)
        try:
            bresp = requests.post(f'{API_URL}/api/v1/admin/bootstrap')
            print('Bootstrap admin:', bresp.status_code)
            try:
                print(bresp.json())
            except Exception:
                print(bresp.text)
        except Exception as e:
            print('Bootstrap request failed:', e)

        # 2) Login as bootstrap admin
        admin_login = {'mobile_or_email': 'admin@system.local', 'password': 'BootstrapAdmin123!'}
        alr = requests.post(f'{API_URL}/api/v1/auth/login', json=admin_login)
        print('Admin login:', alr.status_code)
        try:
            print(alr.json())
        except Exception:
            print(alr.text)

        if alr.ok:
            admin_data = alr.json().get('data', {})
            admin_token = admin_data.get('access_token') or admin_data.get('accessToken')
            headers = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}

            # 3) Activate user
            act = requests.patch(f'{API_URL}/api/v1/admin/users/activate', json={'email': email}, headers=headers)
            print('Activate user:', act.status_code)
            try:
                print(act.json())
            except Exception:
                print(act.text)

            # 4) Try login again as user
            resp2 = requests.post(f'{API_URL}/api/v1/auth/login', json=login_payload)
            print('Login retry:', resp2.status_code)
            try:
                print(resp2.json())
            except Exception:
                print(resp2.text)

            if resp2.ok:
                data = resp2.json().get('data', {})
                token = data.get('access_token') or data.get('accessToken')
                print('Token present after activation:', bool(token))

                headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
                update_payload = {'name': 'HTTP Updated Name', 'country': 'India', 'state': 'Karnataka'}
                r2 = requests.put(f'{API_URL}/api/v1/users/profile', json=update_payload, headers=headers)
                print('Update profile:', r2.status_code)
                try:
                    print(r2.json())
                except Exception:
                    print(r2.text)
            else:
                print('User login still failed after activation')
        else:
            print('Admin login failed; cannot activate user')
    else:
        print('Login failed for unexpected reason; aborting')
