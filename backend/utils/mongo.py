# ===================================
# utils/mongo.py (Enhanced version of your existing file)
# ===================================
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from typing import Dict, List, Any, Optional
from bson import ObjectId
from datetime import datetime

def convert_objectid_to_str(document):
    """Convert ObjectId fields to strings for JSON serialization"""
    if isinstance(document, dict):
        for key, value in document.items():
            if isinstance(value, ObjectId):
                document[key] = str(value)
            elif isinstance(value, dict):
                convert_objectid_to_str(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        convert_objectid_to_str(item)
    return document

from backend.core.config import settings

uri = settings.MONGODB_URL

def insert_document(database_name: str, collection_name: str, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert a document into MongoDB collection
    
    Returns:
        {status: bool, data: str, error: str, code: str}
    """
    try:
        client = MongoClient(uri)
        db = client[database_name]
        collection = db[collection_name]
        
        # Add timestamps if not present
        if 'created_at' not in document:
            document['created_at'] = datetime.utcnow()
        if 'updated_at' not in document:
            document['updated_at'] = datetime.utcnow()
            
        result = collection.insert_one(document)
        client.close()
        return {
            "status": True, 
            "data": str(result.inserted_id), 
            "error": "", 
            "code": ""
        }
    except Exception as e:
        return {
            "status": False, 
            "data": "", 
            "error": str(e), 
            "code": "DBE"
        }

def fetch_documents(database_name: str, collection_name: str, query: Dict[str, Any], 
                   limit: Optional[int] = None, skip: Optional[int] = None,
                   sort: Optional[List[tuple]] = None) -> Dict[str, Any]:
    """
    Fetch documents from MongoDB collection with pagination and sorting
    
    Returns:
        {status: bool, data: list, error: str, code: str}
    """
    try:
        client = MongoClient(uri)
        db = client[database_name]
        collection = db[collection_name]
        
        cursor = collection.find(query)
        
        # Apply sorting
        if sort:
            cursor = cursor.sort(sort)
        
        # Apply pagination
        if skip:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
            
        documents = list(cursor)
        client.close()
        
        # Convert ObjectId to string for JSON serialization
        for doc in documents:
            convert_objectid_to_str(doc)
                
        return {
            "status": True, 
            "data": documents, 
            "error": "", 
            "code": ""
        }
    except Exception as e:
        return {
            "status": False, 
            "data": [], 
            "error": str(e), 
            "code": "DBE"
        }

def update_document(database_name: str, collection_name: str, 
                   filter_field: str, filter_value: Any, 
                   update_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a document in MongoDB collection
    
    Returns:
        {status: bool, data: str, error: str, code: str}
    """
    try:
        client = MongoClient(uri)
        db = client[database_name]
        collection = db[collection_name]
        
        # Handle ObjectId conversion
        if filter_field == "_id" and isinstance(filter_value, str):
            filter_value = ObjectId(filter_value)
            
        # Add updated timestamp
        update_data['updated_at'] = datetime.utcnow()
        
        query = {filter_field: filter_value}
        new_values = {"$set": update_data}
        
        result = collection.update_one(query, new_values)
        client.close()
        
        return {
            "status": True, 
            "data": f"Modified {result.modified_count} document(s)", 
            "error": "", 
            "code": ""
        }
    except Exception as e:
        return {
            "status": False, 
            "data": "", 
            "error": str(e), 
            "code": "DBE"
        }

def delete_document(database_name: str, collection_name: str, query: Dict[str, Any]) -> Dict[str, Any]:
    """
    Delete a document from MongoDB collection
    
    Returns:
        {status: bool, data: str, error: str, code: str}
    """
    try:
        client = MongoClient(uri)
        db = client[database_name]
        collection = db[collection_name]
        
        result = collection.delete_one(query)
        client.close()
        
        return {
            "status": True, 
            "data": f"Deleted {result.deleted_count} document(s)", 
            "error": "", 
            "code": ""
        }
    except Exception as e:
        return {
            "status": False, 
            "data": "", 
            "error": str(e), 
            "code": "DDE"
        }

def delete_collection(database_name: str, collection_name: str) -> Dict[str, Any]:
    """
    Drop a collection from MongoDB
    
    Returns:
        {status: bool, data: str, error: str, code: str}
    """
    try:
        client = MongoClient(uri)
        db = client[database_name]
        collection = db[collection_name]
        collection.drop()
        client.close()
        return {
            "status": True, 
            "data": f"Collection {collection_name} dropped", 
            "error": "", 
            "code": ""
        }
    except Exception as e:
        return {
            "status": False, 
            "data": "", 
            "error": str(e), 
            "code": "DBE"
        }

def count_documents(database_name: str, collection_name: str, query: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Count documents in MongoDB collection
    
    Returns:
        {status: bool, data: int, error: str, code: str}
    """
    try:
        client = MongoClient(uri)
        db = client[database_name]
        collection = db[collection_name]
        
        count = collection.count_documents(query)
        client.close()
        
        return {
            "status": True, 
            "data": count, 
            "error": "", 
            "code": ""
        }
    except Exception as e:
        return {
            "status": False, 
            "data": 0, 
            "error": str(e), 
            "code": "DBE"
        }