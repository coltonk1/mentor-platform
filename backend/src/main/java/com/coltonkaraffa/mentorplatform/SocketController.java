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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

record SendMessageRequest(
    String conversationId,
    String content,
    String type
) {}

record OnlineStatusRequest(
    String type,
    String conversationId
) {}

record TypingRequest(
    String conversationId,
    String type
) {}

record ReadRequest(
    String conversationId,
    String type
) {}

record ConversationCreatedRequest(
    String conversationId,
    String type
) {}

record ChatMessage(
    String id,
    String senderId,
    String conversationId,
    String content,
    String createdAt,
    String type
) {}

record TypeStatus(
    String senderId,
    String createdAt,
    String type
) {}

record UserStatus(
    String userId,
    boolean online
) {}

record OnlineStatusResponse(
    UserStatus[] statuses,
    String type,
    String conversationId
) {}

record ConversationCreatedResponse(
    String conversationId,
    String createdBy,
    String createdAt,
    String type
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

                        handleChat(session, request);
                        break;
                    }
                    case "SEND_TYPING": {
                        TypingRequest request =
                        objectMapper.treeToValue(
                            node,
                            TypingRequest.class
                        );

                        handleType(session, request);
                        break;
                    }
                    case "SEND_READ": {
                        ReadRequest request =
                        objectMapper.treeToValue(
                            node,
                            ReadRequest.class
                        );

                        handleRead(session, request);
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
                    case "CONVERSATION_CREATED": {
                        ConversationCreatedRequest request =
                        objectMapper.treeToValue(
                            node,
                            ConversationCreatedRequest.class
                        );

                        handleConversationCreated(session, request);
                        break;
                    }
                }
            }

            private void broadcastToConversationExceptSender(
                String conversationId,
                String senderId,
                String payload
            ) throws IOException, SQLException {
                Set<String> memberIds = userRepository.getConversationMemberIds(conversationId);

                for (String memberId : memberIds) {
                    if (memberId.equals(senderId)) continue;

                    Set<WebSocketSession> sessions = sessionsByUserId.get(memberId);
                    if (sessions == null) continue;

                    for (WebSocketSession session : sessions) {
                        if (session.isOpen()) {
                            session.sendMessage(new TextMessage(payload));
                        }
                    }
                }
            }

            private void handleConversationCreated(
                WebSocketSession session,
                ConversationCreatedRequest request
            ) throws IOException, SQLException {
                String senderId = getQueryParam(session.getUri(), "userId");

                var response = new ConversationCreatedResponse(
                    request.conversationId(),
                    senderId,
                    Instant.now().toString(),
                    "CONVERSATION_CREATED"
                );

                String payload = objectMapper.writeValueAsString(response);

                Set<String> memberIds = userRepository.getConversationMemberIds(
                    request.conversationId()
                );

                for (String memberId : memberIds) {
                    Set<WebSocketSession> sessions = sessionsByUserId.get(memberId);
                    if (sessions == null) continue;

                    for (WebSocketSession session_ : sessions) {
                        if (session_.isOpen()) {
                            session_.sendMessage(new TextMessage(payload));
                        }
                    }
                }
            }

            private void handleOnlineStatus(
                WebSocketSession session,
                OnlineStatusRequest request
            ) throws IOException, SQLException {
                Set<String> userIds = userRepository.getConversationMemberIds(request.conversationId());

                List<UserStatus> statuses = new ArrayList<>();
                
                for (String userId : userIds) {
                    statuses.add(
                        new UserStatus(
                            userId,
                            isUserOnline(userId)
                        )
                    );
                }

                UserStatus[] result = statuses.toArray(UserStatus[]::new);

                var response = new OnlineStatusResponse(
                    result,
                    "ONLINE_STATUS",
                    request.conversationId()
                );

                session.sendMessage(
                    new TextMessage(
                        objectMapper.writeValueAsString(response)
                    )
                );
            }

            private void handleRead(WebSocketSession session, ReadRequest request) throws IOException, SQLException {
                String senderId = getQueryParam(session.getUri(), "userId");

                userRepository.markConversationRead(
                    request.conversationId(),
                    senderId
                );

                var response = Map.of(
                    "type", "MESSAGE_READ",
                    "conversationId", request.conversationId(),
                    "readerId", senderId,
                    "readAt", Instant.now().toString()
                );

                broadcastToConversationExceptSender(
                    request.conversationId(),
                    senderId,
                    objectMapper.writeValueAsString(response)
                );
            }
            
            private void handleType(WebSocketSession session, TypingRequest request) throws IOException, SQLException {
                String senderId = getQueryParam(session.getUri(), "userId");

                var response = new TypeStatus(
                    senderId,
                    Instant.now().toString(),
                    "SHOW_TYPING"
                );

                broadcastToConversationExceptSender(
                    request.conversationId(),
                    senderId,
                    objectMapper.writeValueAsString(response)
                );
            }

            private void handleChat(WebSocketSession session, SendMessageRequest request) throws IOException, SQLException {
                String senderId = getQueryParam(session.getUri(), "userId");

                ChatMessage chatMessage = new ChatMessage(
                    UUID.randomUUID().toString(),
                    senderId,
                    request.conversationId(),
                    request.content(),
                    Instant.now().toString(),
                    "MESSAGE_RECEIVED"
                );

                userRepository.insertMessage(
                    senderId,
                    request.conversationId(),
                    request.content()
                );

                String payload = objectMapper.writeValueAsString(chatMessage);

                Set<String> memberIds = userRepository.getConversationMemberIds(
                    request.conversationId()
                );

                for (String memberId : memberIds) {
                    Set<WebSocketSession> sessions = sessionsByUserId.get(memberId);

                    if (sessions == null) continue;

                    for (WebSocketSession session_ : sessions) {
                        if (session_.isOpen()) {
                            session_.sendMessage(new TextMessage(payload));
                        }
                    }
                }
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