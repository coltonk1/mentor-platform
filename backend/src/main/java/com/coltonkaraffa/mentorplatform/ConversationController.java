package com.coltonkaraffa.mentorplatform;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/conversation")
public class ConversationController {
    private final UserRepository userRepository;

    public ConversationController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<Conversation>> getConversations(
        @RequestAttribute("uid") String uid) {

        try {
            return ResponseEntity.ok(userRepository.getConversations(uid));
        } catch (SQLException e) {
            System.out.println(e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{conversationId}/members")
    public ResponseEntity<List<ConversationMemberData>> getConversationMembers(
        @RequestAttribute("uid") String uid, 
        @PathVariable String conversationId) {
        // TODO: Verify uid is a part of conversationId
        try {
            return ResponseEntity.ok(userRepository.getConversationMembers(conversationId));
        } catch (SQLException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<List<Message>> getMessages(
        @RequestAttribute("uid") String uid, 
        @PathVariable String conversationId) {
        // TODO: Verify uid is a part of conversationId
        try {
            return ResponseEntity.ok(userRepository.getConversation(conversationId));
        } catch (SQLException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
