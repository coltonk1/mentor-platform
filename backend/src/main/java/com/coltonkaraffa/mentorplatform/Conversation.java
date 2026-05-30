package com.coltonkaraffa.mentorplatform;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Conversation {
    String id = UUID.randomUUID().toString();
    String name;
    String lastMessageId;
    String createdAt;
}