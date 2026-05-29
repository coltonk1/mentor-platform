package com.coltonkaraffa.mentorplatform;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.UUID;

import javax.sql.DataSource;

import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {
    private final DataSource dataSource;

    public UserRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public Message insertMessage(String senderId, String receiverId, String body) throws SQLException {
        String sql = "INSERT INTO messages (id, senderId, receiverId, body) VALUES (?, ?, ?, ?) RETURNING id, senderId, receiverId, body, createdAt";
        
        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, UUID.randomUUID().toString());
            stmt.setString(2, senderId);
            stmt.setString(3, receiverId);
            stmt.setString(4, body);

            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Failed to get generated key");
                }

                return new Message(
                    rs.getString("id"),
                    rs.getString("senderId"),
                    rs.getString("receiverId"),
                    rs.getString("body"),
                    rs.getString("createdAt")
                );
            }
        }
    }

    public ArrayList<Message> getConversation(String id1, String id2) throws SQLException {
        String sql = "SELECT * FROM messages WHERE (senderId = ? AND receiverId = ?) OR (receiverId = ? AND senderId = ?)";

        ArrayList<Message> output = new ArrayList<>();

        try (
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, id1);
            stmt.setString(2, id2);
            stmt.setString(3, id1);
            stmt.setString(4, id2);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Message message = new Message(
                        rs.getString("id"),
                        rs.getString("senderId"),
                        rs.getString("receiverId"),
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
}
