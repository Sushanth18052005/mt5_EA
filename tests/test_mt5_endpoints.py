import requests
import json
import uuid
import time
from datetime import datetime
import sys

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@4xengineer.com"
ADMIN_PASSWORD = "admin123"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

def get_admin_token():
    log("Existing Admin Login...", YELLOW)
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"mobile_or_email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            token = response.json().get("data", {}).get("access_token")
            if token:
                log("✅ Admin login successful", GREEN)
                return token
    except Exception as e:
        log(f"❌ Connection failed: {e}", RED)
    
    log("❌ Admin login failed", RED)
    sys.exit(1)

def test_master_flow(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Add Master
    log("\nTesting Master Creation...", YELLOW)
    master_email = f"master_{int(time.time())}@test.com"
    master_payload = {
        "name": "Test Master",
        "email": master_email,
        "password": "Password123",
        "mobile_number": "1234567890",
        "no_of_slave": 10,
        "status": True,
        "start_date": datetime.now().strftime("%Y-%m-%d"),
        "end_date": "2030-12-31"
    }
    
    master_id = None
    try:
        res = requests.post(f"{BASE_URL}/api/master-add", json=master_payload, headers=headers)
        if res.status_code == 200:
            log("✅ Master added successfully", GREEN)
        else:
            log(f"❌ Failed to add master: {res.text}", RED)
            return None, None
    except Exception as e:
        log(f"❌ Exception adding master: {e}", RED)
        return None, None

    # 2. Get All Masters and find our master
    log("\nVerifying Master in List...", YELLOW)
    try:
        res = requests.get(f"{BASE_URL}/api/all-masters", headers=headers)
        if res.status_code == 200:
            masters = res.json().get("data", {}).get("masters", [])
            for m in masters:
                if m.get("email") == master_email:
                    master_id = m.get("master_id")
                    # Also try to get integer ID if available (some old logic might use 'id' or 'trade_id')
                    log(f"✅ Found master in list. ID: {master_id} (Type: {type(master_id)})", GREEN)
                    break
            
            if not master_id:
                log("❌ Master not found in list", RED)
                return None, None
        else:
            log(f"❌ Failed to fetch masters: {res.text}", RED)
            return None, None
    except Exception as e:
        log(f"❌ Exception fetching masters: {e}", RED)
        return None, None

    # 3. Update Master Status
    log("\nTesting Master Status Update...", YELLOW)
    # The endpoint expects 'trade_id' as int, but we likely have a UUID string 'master_id'.
    # This is where we expect failure if the schema hasn't been updated.
    
    status_payload = {
        "trade_id": master_id, # Trying to send the ID we got (likely string)
        "status": False
    }
    
    # Check if master_id is int or string to anticipate error
    if isinstance(master_id, str):
        log(f"⚠️ Sending UUID string '{master_id}' to endpoint expecting int 'trade_id'", YELLOW)
    
    try:
        res = requests.post(f"{BASE_URL}/api/master-status", json=status_payload, headers=headers)
        if res.status_code == 200:
            log("✅ Master status updated successfully", GREEN)
        elif res.status_code == 422:
            log("❌ Validation Error (Expected): Endpoint likely requires Integer ID", RED)
            log(f"Response: {res.text}", RED)
        else:
            log(f"❌ Failed master status update: {res.status_code} {res.text}", RED)
    except Exception as e:
        log(f"❌ Exception updating master status: {e}", RED)

    return master_id, master_email

def test_slave_flow(token, master_id, master_email):
    if not master_id:
        log("\n⚠️ Skipping Slave tests because Master creation failed", YELLOW)
        return

    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Add Slave
    log("\nTesting Slave Creation...", YELLOW)
    slave_payload = {
        "name": "Test Slave",
        "email": f"slave_{int(time.time())}@test.com",
        "mobile_number": "9876543210",
        "status": True,
        "start_date": datetime.now().strftime("%Y-%m-%d"),
        "end_date": "2030-12-31",
        "master_id": master_id,
        "master_email": master_email
    }

    slave_id = None
    try:
        res = requests.post(f"{BASE_URL}/api/slave-add", json=slave_payload, headers=headers)
        if res.status_code == 200:
            log("✅ Slave added successfully", GREEN)
            data = res.json().get("data", {})
            slave_id = data.get("slave_id")
            if slave_id:
                 log(f"✅ Captured Slave ID: {slave_id}", GREEN)
        elif res.status_code == 422:
            log("❌ Validation Error (Expected): Endpoint likely requires Integer master_id", RED)
            log(f"Response: {res.text}", RED)
            return
        else:
            log(f"❌ Failed to add slave: {res.text}", RED)
            return
    except Exception as e:
        log(f"❌ Exception adding slave: {e}", RED)
        return

    # 2. Get All Slaves (Slave Traders List)
    log("\nVerifying Slave in List...", YELLOW)
    try:
        res = requests.get(f"{BASE_URL}/api/all-slaves", headers=headers)
        if res.status_code == 200:
            slaves = res.json().get("data", [])
            found = False
            for s in slaves:
                if s.get("slave_id") == slave_id:
                    log(f"✅ Found slave in list. ID: {s.get('slave_id')}", GREEN)
                    found = True
                    break
            
            if not found:
                log("❌ Slave not found in list", RED)
        else:
            log(f"❌ Failed to fetch slaves: {res.text}", RED)
    except Exception as e:
        log(f"❌ Exception fetching slaves: {e}", RED)

    # 3. Delete Slave
    log("\nTesting Slave Delete...", YELLOW)
    if not slave_id:
         log("⚠️ Skipping Slave Delete because Slave ID was not captured", YELLOW)
         return

    # Assuming slave-delete uses POST with json body based on other endpoints, or DELETE ?
    # Let's try POST to /api/slave-delete with slave_id
    # api/slave-delete uses DELETE method with body key 'slave_id'
    try:
        delete_payload = {"slave_id": slave_id}
        # requests.delete allows json body
        res = requests.request("DELETE", f"{BASE_URL}/api/slave-delete", json=delete_payload, headers=headers)
        if res.status_code == 200:
            log("✅ Slave deleted successfully", GREEN)
        else:
            log(f"❌ Failed to delete slave: {res.status_code} {res.text}", RED)
    except Exception as e:
        log(f"❌ Exception deleting slave: {e}", RED)

if __name__ == "__main__":
    log("🚀 Starting MT5 API Tests...\n", YELLOW)
    
    token = get_admin_token()
    m_id, m_email = test_master_flow(token)
    test_slave_flow(token, m_id, m_email)
    
    log("\n🏁 Tests Completed", YELLOW)
