"""Direct DB update test using backend/utils/mongo.py (sync).

Finds a user by email, prints existing fields, updates name/country/state, then prints updated document.

Run from project root:
python tools\db_direct_update_test.py
"""
from backend.utils.mongo import fetch_documents, update_document

email = 'admin@test.com'

print('Fetching user with email:', email)
res = fetch_documents('mt5_copy_trading', 'users', {'email': email}, limit=1)
print('Fetch result status:', res['status'])
if res['status'] and res['data']:
    user = res['data'][0]
    print('Before update:', {k: user.get(k) for k in ['_id','name','email','country','state']})

    update = {'name': 'Admin DB Updated', 'country': 'India', 'state': 'Karnataka'}
    up = update_document('mt5_copy_trading', 'users', 'email', email, update)
    print('Update call result:', up)

    res2 = fetch_documents('mt5_copy_trading', 'users', {'email': email}, limit=1)
    if res2['status'] and res2['data']:
        user2 = res2['data'][0]
        print('After update:', {k: user2.get(k) for k in ['_id','name','email','country','state','updated_at']})
    else:
        print('Failed to fetch after update')
else:
    print('User not found for email:', email)
