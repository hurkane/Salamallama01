import React, { useState } from "react";

export default function ChatRoom({ chat, userId }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(chat.messages || []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Example API call to send a message (you'll need to implement this function)
    const newMessage = {
      sender: userId,
      content: message,
      createdAt: new Date(),
    };

    // Update messages state with the new message
    setMessages([...messages, newMessage]);
    setMessage(""); // Clear input field

    // API call to send the message (replace with your actual API call)
    try {
      await sendMessageToApi(chat._id, newMessage); // Implement this function
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally handle the error (e.g., show an error message to the user)
    }
  };

  return (
    <div>
      <h1>Chat Room</h1>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.sender === userId ? "You" : msg.sender}:</strong>{" "}
            {msg.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
