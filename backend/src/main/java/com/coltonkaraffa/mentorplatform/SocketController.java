package com.coltonkaraffa.mentorplatform;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.io.IOException;
import java.net.URI;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

record SendMessageRequest(
    String senderId,
    String receiverId,
    String content,
    String type
) {}

record OnlineStatusRequest(
    String type,
    String[] userIds
) {}

record ChatMessage(
    String id,
    String type,
    String senderId,
    String receiverId,
    String content,
    String createdAt
) {}

record TypeStatus(
    String type,
    String senderId,
    String createdAt
) {}

record UserStatus(
    String receiverId,
    boolean online
) {}

record OnlineStatusResponse(
    String type,
    UserStatus[] userIds
) {}

@Configuration
@EnableWebSocket
public class SocketController implements WebSocketConfigurer {

    private final UserRepository userRepository;

    private final ObjectMapper objectMapper =
        new ObjectMapper().findAndRegisterModules();

    private final Map<String, Set<WebSocketSession>> sessionsByUserId =
        new ConcurrentHashMap<>();
    
    private final ScheduledExecutorService scheduler =
        Executors.newScheduledThreadPool(1);
    
    private final Map<String, ScheduledFuture<?>> heartbeatTasks = new ConcurrentHashMap<>();

    Map<String, Instant> lastPong = new ConcurrentHashMap<>();

    public SocketController(UserRepository userRepository) {
        this.userRepository = userRepository;

        scheduler.scheduleAtFixedRate(
            () -> {
                System.out.println(
                    "Connected users: " + sessionsByUserId.size()
                );
            },
            0,
            30,
            TimeUnit.SECONDS
        );
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler(), "/ws")
            .setAllowedOrigins("*");
    }

    public WebSocketHandler handler() {
        return new TextWebSocketHandler() {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) {
                String userId = getQueryParam(session.getUri(), "userId");

                if (userId == null || userId.isBlank()) {
                    try {
                        session.close(CloseStatus.BAD_DATA);
                    } catch (Exception ignored) {}

                    return;
                }

                sessionsByUserId.computeIfAbsent(
                    userId, 
                    k -> ConcurrentHashMap.newKeySet()
                ).add(session);

                lastPong.put(session.getId(), Instant.now());

                ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(
                    () -> {
                        try {
                            Instant last = lastPong.get(session.getId());

                            if (last == null || Duration.between(last, Instant.now()).toSeconds() > 60) {
                                session.close();
                                return;
                            }

                            if (session.isOpen()) {
                                session.sendMessage(new PingMessage());
                            }
                        } catch (Exception e) {
                            try {
                                session.close();
                            } catch (Exception ignored) {}
                        }
                    },
                    30,
                    30,
                    TimeUnit.SECONDS
                );

                heartbeatTasks.putIfAbsent(session.getId(), task);

                System.out.println("Connected user: " + userId);
            }

            @Override
            public void afterConnectionClosed(
                WebSocketSession session,
                CloseStatus status
            ) {
                String userId = getQueryParam(session.getUri(), "userId");
                
                Set<WebSocketSession> sessions = sessionsByUserId.get(userId);
                if (sessions != null) {
                    sessions.remove(session);

                    ScheduledFuture<?> task = heartbeatTasks.remove(session.getId());
                    if (task != null) {
                        task.cancel(true);
                    }

                    if (lastPong.get(session.getId()) != null) {
                        lastPong.remove(session.getId());
                    }

                    System.out.println("Disconnected user: " + userId);

                    if (sessions.isEmpty()) {
                        sessionsByUserId.remove(userId);
                    }
                }
            }

            @Override
            protected void handlePongMessage(WebSocketSession session, PongMessage message) {
                lastPong.put(session.getId(), Instant.now());
            }

            @Override
            protected void handleTextMessage(
                WebSocketSession session,
                TextMessage message
            ) throws Exception {
                JsonNode node = objectMapper.readTree(message.getPayload());
                
                switch (node.get("type").asText()) {
                    case "SEND_MESSAGE": {
                        SendMessageRequest request =
                        objectMapper.treeToValue(
                            node,
                            SendMessageRequest.class
                        );

                        handleChat(request);
                        break;
                    }
                    case "TYPING": {
                        SendMessageRequest request =
                        objectMapper.treeToValue(
                            node,
                            SendMessageRequest.class
                        );

                        handleType(request);
                        break;
                    }
                    case "GET_ONLINE_STATUS": {
                        OnlineStatusRequest request =
                        objectMapper.treeToValue(
                            node,
                            OnlineStatusRequest.class
                        );

                        handleOnlineStatus(session, request);
                        break;
                    }
                }
            }

            private void handleOnlineStatus(
                WebSocketSession requester,
                OnlineStatusRequest request
            ) throws IOException {

                UserStatus[] statuses =
                    Arrays.stream(request.userIds())
                        .map(userId ->
                            new UserStatus(
                                userId,
                                isUserOnline(userId)
                            )
                        )
                        .toArray(UserStatus[]::new);

                var response = new OnlineStatusResponse(
                    "ONLINE_STATUS",
                    statuses
                );

                requester.sendMessage(
                    new TextMessage(
                        objectMapper.writeValueAsString(response)
                    )
                );
            }
            
            private void handleType(SendMessageRequest request) throws JsonProcessingException, IOException {
                Set<WebSocketSession> receiverSessions =
                    sessionsByUserId.get(request.receiverId());

                var response = new TypeStatus("SHOW_TYPING", request.receiverId(), Instant.now().toString());

                if (receiverSessions != null) {
                    for (WebSocketSession session : receiverSessions) {
                        if (session.isOpen()) {
                            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                        }
                    }
                }
            }

            private void handleChat(SendMessageRequest request) throws IOException, SQLException {
                ChatMessage chatMessage = new ChatMessage(
                    UUID.randomUUID().toString(),
                    "MESSAGE_RECEIVED",
                    request.senderId(),
                    request.receiverId(),
                    request.content(),
                    Instant.now().toString()
                );

                String payload = objectMapper.writeValueAsString(chatMessage);

                Set<WebSocketSession> receiverSessions =
                    sessionsByUserId.get(request.receiverId());

                if (receiverSessions != null) {
                    for (WebSocketSession session : receiverSessions) {
                        if (session.isOpen()) {
                            session.sendMessage(new TextMessage(payload));
                        }
                    }
                }

                Set<WebSocketSession> senderSessions =
                    sessionsByUserId.get(request.senderId());

                if (senderSessions != null) {
                    for (WebSocketSession session : senderSessions) {
                        if (session.isOpen()) {
                            session.sendMessage(new TextMessage(payload));
                        }
                    }
                }

                userRepository.insertMessage(request.senderId(), request.receiverId(), request.content());
            }

            private boolean isUserOnline(String userId) {
                Set<WebSocketSession> sessions = sessionsByUserId.get(userId);

                if (sessions == null || sessions.isEmpty()) {
                    return false;
                }

                return sessions.stream().anyMatch(WebSocketSession::isOpen);
            }

            @Override
            public void handleTransportError(
                WebSocketSession session,
                Throwable exception
            ) {
                exception.printStackTrace();
            }
        };
    }

    private static String getQueryParam(URI uri, String key) {
        if (uri == null || uri.getQuery() == null) {
            return null;
        }

        for (String param : uri.getQuery().split("&")) {
            String[] pair = param.split("=", 2);

            if (pair.length == 2 && pair[0].equals(key)) {
                return pair[1];
            }
        }

        return null;
    }
}