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
public class Message {
    String id = UUID.randomUUID().toString();
    String senderId;
    String receiverId;
    String body;
    String createdAt;
}
