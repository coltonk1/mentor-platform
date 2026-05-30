CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('MENTEE', 'MENTOR', 'ADMIN')),
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    name TEXT,
    lastMessageId TEXT,
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (lastMessageId) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversationId TEXT NOT NULL,
    userId TEXT NOT NULL,
    lastReadAt TEXT,
    PRIMARY KEY (conversationId, userId),
    FOREIGN KEY (conversationId) REFERENCES conversations(id),
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    body TEXT NOT NULL,
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (conversationId) REFERENCES conversations(id),
    FOREIGN KEY (senderId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS mentee_profiles (
    userId TEXT PRIMARY KEY,
    primaryMentorId TEXT,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (primaryMentorId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    mentorId TEXT NOT NULL,
    menteeId TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    status TEXT NO NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    notes TEXT,
    createdby TEXT NOT NULL CHECK (createdBy IN ('MENTOR', 'MENTEE', 'ADMIN')),
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (mentorId) REFERENCES users(id),
    FOREIGN KEY (menteeId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS mentor_availability (
    id TEXT PRIMARY KEY,
    mentorId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    FOREIGN KEY (mentorId) REFERENCES users(id)
);