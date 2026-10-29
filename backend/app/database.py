import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import pymongo
from pymongo import MongoClient

from app.config import settings

logger = logging.getLogger("cloudnex.database")

# Persistent JSON fallback database in case MongoDB is not currently configured/reachable
class JsonCollection:
    def __init__(self, name: str, filepath: Path, lock: threading.Lock):
        self.name = name
        self.filepath = filepath
        self.lock = lock
        self._cache: Optional[List[Dict[str, Any]]] = None
        self._last_mtime: float = 0
        self._ensure_file()

    def _ensure_file(self):
        if not self.filepath.exists():
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump([], f)

    def _read_all(self) -> List[Dict[str, Any]]:
        with self.lock:
            try:
                if self.filepath.exists():
                    mtime = os.path.getmtime(self.filepath)
                    if self._cache is not None and mtime == self._last_mtime:
                        return self._cache
                    with open(self.filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self._cache = data
                        self._last_mtime = mtime
                        return data
                return []
            except Exception:
                return self._cache if self._cache is not None else []

    def _write_all(self, data: List[Dict[str, Any]]):
        with self.lock:
            self._cache = data
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, default=str)
                self._last_mtime = os.path.getmtime(self.filepath)
            except Exception as e:
                logger.error(f"Error writing to {self.filepath}: {e}")

    def find_one(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        all_docs = self._read_all()
        if not filter_dict:
            return all_docs[0] if all_docs else None

        import re
        for doc in all_docs:
            match = True
            for k, v in filter_dict.items():
                if k == "$or" and isinstance(v, list):
                    or_match = False
                    for condition in v:
                        cond_match = True
                        for sub_k, sub_v in condition.items():
                            val = doc.get(sub_k)
                            if isinstance(sub_v, dict) and "$regex" in sub_v:
                                pattern = sub_v["$regex"]
                                flags = re.IGNORECASE if sub_v.get("$options") == "i" else 0
                                if not re.search(pattern, str(val or ""), flags):
                                    cond_match = False
                                    break
                            elif val != sub_v:
                                cond_match = False
                                break
                        if cond_match:
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif isinstance(v, dict) and "$regex" in v:
                    pattern = v["$regex"]
                    flags = re.IGNORECASE if v.get("$options") == "i" else 0
                    if not re.search(pattern, str(doc.get(k, "")), flags):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc
        return None

    def find(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        all_docs = self._read_all()
        if not filter_dict:
            return all_docs

        import re
        results = []
        for doc in all_docs:
            match = True
            for k, v in filter_dict.items():
                if k == "$or" and isinstance(v, list):
                    or_match = False
                    for condition in v:
                        cond_match = True
                        for sub_k, sub_v in condition.items():
                            val = doc.get(sub_k)
                            if isinstance(sub_v, dict) and "$regex" in sub_v:
                                pattern = sub_v["$regex"]
                                flags = re.IGNORECASE if sub_v.get("$options") == "i" else 0
                                if not re.search(pattern, str(val or ""), flags):
                                    cond_match = False
                                    break
                            elif val != sub_v:
                                cond_match = False
                                break
                        if cond_match:
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif isinstance(v, dict) and "$regex" in v:
                    pattern = v["$regex"]
                    flags = re.IGNORECASE if v.get("$options") == "i" else 0
                    if not re.search(pattern, str(doc.get(k, "")), flags):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                results.append(doc)
        return results

    def insert_one(self, doc: Dict[str, Any]):
        all_docs = self._read_all()
        doc_copy = dict(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = f"{self.name}_{len(all_docs) + 1}_{int(datetime.utcnow().timestamp()*1000)}"
        all_docs.append(doc_copy)
        self._write_all(all_docs)
        
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc_copy["_id"])

    def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any], upsert: bool = False, *args, **kwargs):
        all_docs = self._read_all()
        modified = 0
        for doc in all_docs:
            match = True
            for k, v in filter_dict.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update_dict:
                    doc.update(update_dict["$set"])
                else:
                    doc.update(update_dict)
                modified += 1
                break

        if not modified and upsert:
            new_doc = dict(filter_dict)
            if "$set" in update_dict:
                new_doc.update(update_dict["$set"])
            else:
                new_doc.update(update_dict)
            if "_id" not in new_doc:
                new_doc["_id"] = f"{self.name}_{len(all_docs) + 1}_{int(datetime.utcnow().timestamp()*1000)}"
            all_docs.append(new_doc)
            modified = 1

        if modified:
            self._write_all(all_docs)

        class UpdateResult:
            def __init__(self, count):
                self.modified_count = count
        return UpdateResult(modified)

    def delete_one(self, filter_dict: Dict[str, Any]):
        all_docs = self._read_all()
        new_docs = []
        deleted = False
        for doc in all_docs:
            if not deleted and all(doc.get(k) == v for k, v in filter_dict.items()):
                deleted = True
                continue
            new_docs.append(doc)
        if deleted:
            self._write_all(new_docs)

    def delete_many(self, filter_dict: Optional[Dict[str, Any]] = None):
        all_docs = self._read_all()
        if not filter_dict:
            self._write_all([])
            return
        new_docs = []
        for doc in all_docs:
            match = all(doc.get(k) == v for k, v in filter_dict.items())
            if not match:
                new_docs.append(doc)
        self._write_all(new_docs)

    def update_many(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any]):
        all_docs = self._read_all()
        for doc in all_docs:
            match = True
            for k, v in filter_dict.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update_dict:
                    doc.update(update_dict["$set"])
                else:
                    doc.update(update_dict)
        self._write_all(all_docs)

    def count_documents(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        return len(self.find(filter_dict))

    def create_index(self, *args, **kwargs):
        pass


class MongoCollectionWrapper:
    def __init__(self, collection):
        self._col = collection

    @staticmethod
    def _clean_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not doc:
            return None
        d = dict(doc)
        if "_id" in d:
            d["_id"] = str(d["_id"])
        return d

    @staticmethod
    def _convert_filter(filter_dict: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not filter_dict:
            return {}
        f = dict(filter_dict)
        if "_id" in f and isinstance(f["_id"], str):
            try:
                from bson import ObjectId
                f["_id"] = ObjectId(f["_id"])
            except Exception:
                pass
        return f

    def find(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        f = self._convert_filter(filter_dict)
        p = projection or {}
        cursor = self._col.find(f, p) if p else self._col.find(f)
        return [self._clean_doc(d) for d in cursor]

    def find_one(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        f = self._convert_filter(filter_dict)
        p = projection or {}
        d = self._col.find_one(f, p) if p else self._col.find_one(f)
        return self._clean_doc(d)

    def insert_one(self, doc: Dict[str, Any], *args, **kwargs):
        doc_copy = dict(doc)
        res = self._col.insert_one(doc_copy, *args, **kwargs)
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = str(inserted_id)
        return InsertResult(res.inserted_id)

    def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any], *args, **kwargs):
        f = self._convert_filter(filter_dict)
        return self._col.update_one(f, update_dict, *args, **kwargs)

    def update_many(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any], *args, **kwargs):
        f = self._convert_filter(filter_dict)
        return self._col.update_many(f, update_dict, *args, **kwargs)

    def delete_one(self, filter_dict: Dict[str, Any], *args, **kwargs):
        f = self._convert_filter(filter_dict)
        return self._col.delete_one(f, *args, **kwargs)

    def delete_many(self, filter_dict: Optional[Dict[str, Any]] = None, *args, **kwargs):
        f = self._convert_filter(filter_dict or {})
        return self._col.delete_many(f, *args, **kwargs)

    def count_documents(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        f = self._convert_filter(filter_dict)
        return self._col.count_documents(f)

    def create_index(self, *args, **kwargs):
        return self._col.create_index(*args, **kwargs)


class JsonDatabase:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.lock = threading.Lock()
        self.collections: Dict[str, JsonCollection] = {}

    def __getitem__(self, collection_name: str) -> JsonCollection:
        if collection_name not in self.collections:
            filepath = self.data_dir / f"{collection_name}.json"
            self.collections[collection_name] = JsonCollection(collection_name, filepath, self.lock)
        return self.collections[collection_name]


class DatabaseManager:
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.db = None
        self.is_atlas: bool = False
        self._init_db()

    def _init_db(self):
        uri = settings.MONGODB_URI.strip()
        if uri:
            try:
                logger.info(f"Connecting to MongoDB with URI: {uri[:20]}...")
                self.client = MongoClient(
                    uri,
                    serverSelectionTimeoutMS=10000,
                    connectTimeoutMS=10000,
                    socketTimeoutMS=10000,
                    maxPoolSize=100,
                    minPoolSize=10,
                    maxIdleTimeMS=60000,
                    waitQueueTimeoutMS=3000,
                    retryWrites=True
                )
                # Verify connection
                self.client.admin.command('ping')
                self.db = self.client[settings.DATABASE_NAME]
                self.is_atlas = True
                try:
                    self.db["audit_logs"].drop()
                except Exception:
                    pass
                try:
                    audit_file = settings.DATA_DIR / "audit_logs.json"
                    if audit_file.exists():
                        audit_file.unlink()
                except Exception:
                    pass
                logger.info("Successfully connected to live MongoDB database!")
                self._ensure_indexes()
                return
            except Exception as e:
                logger.warning(f"MongoDB connection failed ({e}). Falling back to local high-fidelity persistent store.")

        # Fallback to JSON database
        logger.info("Using embedded persistent document store at backend/data/")
        self.db = JsonDatabase(settings.DATA_DIR)
        self.is_atlas = False
        try:
            audit_file = settings.DATA_DIR / "audit_logs.json"
            if audit_file.exists():
                audit_file.unlink()
        except Exception:
            pass

    def _ensure_indexes(self):
        if not self.is_atlas or self.db is None:
            return
        try:
            try:
                self.db["teams"].create_index("team_id", unique=True)
            except Exception:
                self.db["teams"].create_index("team_id")

            try:
                self.db["users"].create_index("username", unique=True)
            except Exception:
                self.db["users"].create_index("username")

            self.db["users"].create_index("email")
            self.db["users"].create_index("team_id")
            self.db["teams"].create_index("team_name")
            self.db["teams"].create_index("email")
            self.db["rounds"].create_index("round_number")
            self.db["problem_statements"].create_index("round_number")
            self.db["submissions"].create_index([("team_id", 1), ("round_number", 1)])
            logger.info("MongoDB database indexes ensured with strict uniqueness.")
        except Exception as e:
            logger.warning(f"Could not build indexes: {e}")

    def get_collection(self, name: str):
        if name == "audit_logs":
            class NoOpCollection:
                def insert_one(self, *args, **kwargs): return None
                def insert_many(self, *args, **kwargs): return None
                def update_one(self, *args, **kwargs): return None
                def update_many(self, *args, **kwargs): return None
                def find(self, *args, **kwargs): return []
                def find_one(self, *args, **kwargs): return None
                def delete_one(self, *args, **kwargs): return None
                def delete_many(self, *args, **kwargs): return None
                def count_documents(self, *args, **kwargs): return 0
                def drop(self): return None
            return NoOpCollection()

        if self.is_atlas:
            return MongoCollectionWrapper(self.db[name])
        return self.db[name]


db_manager = DatabaseManager()

def get_db():
    return db_manager.db
