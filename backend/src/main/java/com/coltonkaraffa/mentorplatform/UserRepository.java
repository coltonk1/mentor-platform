package com.coltonkaraffa.mentorplatform;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import javax.sql.DataSource;

import org.springframework.stereotype.Repository;

record ConversationMemberData(
    String id,
    String name,
    String lastReadAt
) {}

@Repository
public class UserRepository {
    private final DataSource dataSource;

    public UserRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public Message insertMessage(String senderId, String conversationId, String body) throws SQLException {
        String sql = "INSERT INTO messages (id, senderId, conversationId, body) VALUES (?, ?, ?, ?) RETURNING id, senderId, conversationId, body, createdAt";
        
        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, UUID.randomUUID().toString());
            stmt.setString(2, senderId);
            stmt.setString(3, conversationId);
            stmt.setString(4, body);

            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Failed to get generated key");
                }

                return new Message(
                    rs.getString("id"),
                    rs.getString("senderId"),
                    rs.getString("conversationId"),
                    rs.getString("body"),
                    rs.getString("createdAt")
                );
            }
        }
    }

    public ArrayList<Message> getConversation(String conversationId) throws SQLException {
        String sql = "SELECT * FROM messages WHERE conversationId = ?";

        ArrayList<Message> output = new ArrayList<>();

        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, conversationId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Message message = new Message(
                        rs.getString("id"),
                        rs.getString("senderId"),
                        rs.getString("conversationId"),
                        rs.getString("body"),
                        rs.getString("createdAt")
                    );

                    output.add(message);
                }
            }
        }

        return output;
    }

    public User getUserById(String id) throws SQLException {
        String sql = "SELECT * FROM users WHERE id = ?";

        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, id);

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return new User(
                        rs.getString("id"),
                        rs.getString("username"),
                        rs.getString("email")
                    );
                }
            }
        }

        return null;
    }

    public Set<String> getConversationMemberIds(String conversationId) throws SQLException {
        String sql = """
            SELECT userId
            FROM conversation_members
            WHERE conversationId = ?
        """;

        Set<String> userIds = new HashSet<>();

        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, conversationId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    userIds.add(rs.getString("userId"));
                }
            }
        }

        return userIds;
    }

    public void markConversationRead(
        String conversationId,
        String userId
    ) throws SQLException {
        String sql = """
            UPDATE conversation_members
            SET lastReadAt = ?
            WHERE conversationId = ?
            AND userId = ?
        """;

        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, Instant.now().toString());
            stmt.setString(2, conversationId);
            stmt.setString(3, userId);

            stmt.executeUpdate();
        }
    }

    public List<Conversation> getConversations(String uid) throws SQLException {
        String sql = """
            SELECT c.id, c.name, c.lastMessageId, c.createdAt
            FROM conversation_members cm
            JOIN conversations c ON c.id = cm.conversationId
            WHERE cm.userId = ?
            """;
        
        List<Conversation> conversations = new ArrayList<>();

        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, uid);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Conversation conversation = new Conversation(rs.getString("id"), rs.getString("name"), rs.getString("lastMessageId"), rs.getString("createdAt"));
                    conversations.add(conversation);
                }
            }
        }

        return conversations;
    }

    public List<ConversationMemberData> getConversationMembers(String conversationId) throws SQLException {
        String sql = """
                SELECT cm.userId, cm.lastReadAt, u.name
                FROM conversation_members cm
                JOIN users u ON u.id = cm.userId
                WHERE cm.conversationId = ?
                """;
        
        List<ConversationMemberData> membersData = new ArrayList<>();

        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, conversationId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    ConversationMemberData data = new ConversationMemberData(rs.getString("userId"), rs.getString("name"), rs.getString("lastReadAt"));
                    membersData.add(data);
                }
            }
        }

        return membersData;
    }
    
}
