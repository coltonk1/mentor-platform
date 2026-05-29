package com.coltonkaraffa.mentorplatform;

import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class User {
    private String id = UUID.randomUUID().toString();
    private String username;
    private String email;
}