PRAGMA foreign_keys = ON;
CREATE TABLE plants(id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE reservoirs(id TEXT PRIMARY KEY, plant_id TEXT NOT NULL REFERENCES plants(id), name TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(plant_id,name));
CREATE TABLE teams(id TEXT PRIMARY KEY, name TEXT NOT NULL, profile_json TEXT, version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE requests(id TEXT PRIMARY KEY, reservoir_id TEXT NOT NULL REFERENCES reservoirs(id), protocol TEXT NOT NULL UNIQUE,
 description TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 access_latitude REAL CHECK(access_latitude BETWEEN -90 AND 90), access_longitude REAL CHECK(access_longitude BETWEEN -180 AND 180),
 service_seconds INTEGER NOT NULL CHECK(service_seconds BETWEEN 60 AND 86400), source_siga_id INTEGER UNIQUE, source_protocol TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK((access_latitude IS NULL)=(access_longitude IS NULL)));
CREATE TABLE orders(id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), order_number TEXT NOT NULL UNIQUE,
 idempotency_key TEXT NOT NULL UNIQUE, input_hash TEXT NOT NULL, base_latitude REAL NOT NULL, base_longitude REAL NOT NULL,
 access_latitude REAL NOT NULL, access_longitude REAL NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
CREATE TABLE audit_events(id TEXT PRIMARY KEY, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, subject_id TEXT NOT NULL, details_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX idx_request_status ON requests(status,created_at);
CREATE INDEX idx_audit_created ON audit_events(created_at);
CREATE TABLE login_attempts(key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
