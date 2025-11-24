# ===================================
# core/database.py
# ===================================
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError
from backend.core.config import settings

client = None
database = None

async def connect_to_mongo():
    global client, database
    try:
        print("Attempting to connect to MongoDB...")

        # Use motor for async MongoDB operations
        client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=10000,  # 10 second timeout
            connectTimeoutMS=10000,
            maxPoolSize=10,
            minPoolSize=1,
            retryWrites=True,
            w='majority'
        )

        database = client[settings.DATABASE_NAME]

        # Test connection
        await client.admin.command('ping')
        print("Successfully connected to MongoDB")

        # Create indexes for better performance
        await setup_indexes()
        print("Database indexes created successfully")

    except ServerSelectionTimeoutError as e:
        print(f"MongoDB connection timeout: {e}")
        print("Server will start without database (will retry connections on requests)")
        client = None
        database = None
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        print("Server will start without database (will retry connections on requests)")
        client = None
        database = None

async def setup_indexes():
    """Set up database indexes"""
    if client is not None and database is not None:
        try:
            # Create indexes for better performance
            await database.users.create_index("email", unique=True)
            await database.users.create_index("mobile", unique=True)
            await database.groups.create_index("group_name", unique=True)
            await database.groups.create_index("api_key", unique=True)
            await database.members.create_index([("user_id", 1), ("group_id", 1)], unique=True)
            await database.settlements.create_index("group_id")
            await database.trades.create_index("master_account_id")
            await database.error_logs.create_index("timestamp")
            await database.otp_records.create_index("mobile_or_email")
            await database.otp_records.create_index("expires_at")
        except Exception as e:
            print(f"Index creation failed (might already exist): {e}")

async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")

def get_database():
    return database