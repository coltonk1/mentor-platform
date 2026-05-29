package com.coltonkaraffa.mentorplatform;

import java.sql.SQLException;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
public class MessageController {
    private final UserRepository userRepository;

    public MessageController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Message> getMessages(
        @RequestParam String id1,
        @RequestParam String id2
    ) throws SQLException {
        return userRepository.getConversation(id1, id2);
    }
}
