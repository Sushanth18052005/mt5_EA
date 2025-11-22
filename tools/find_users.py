"""Find user documents for diagnosis.

Searches for admin@test.com and emails starting with testapi+ in the users collection and prints selected fields.
"""
from backend.utils import mongo

def print_docs(res):
    if not res['status']:
        print('Query failed:', res.get('error'))
        return
    docs = res.get('data', [])
    print(f'Found {len(docs)} documents')
    for d in docs:
        print({
            'id': d.get('_id') or d.get('id'),
            'user_id': d.get('user_id'),
            'email': d.get('email'),
            'mobile': d.get('mobile'),
            'status': d.get('status'),
            'ib_status': d.get('ib_status'),
            'created_at': d.get('created_at')
        })

print('Searching for admin@test.com')
res_admin = mongo.fetch_documents('mt5_copy_trading', 'users', {'email': 'admin@test.com'}, limit=5)
print_docs(res_admin)

print('\nSearching for emails starting with testapi+')
res_testapi = mongo.fetch_documents('mt5_copy_trading', 'users', {'email': {'$regex': '^testapi\+'}}, limit=50)
print_docs(res_testapi)
