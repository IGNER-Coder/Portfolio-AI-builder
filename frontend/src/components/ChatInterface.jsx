import React, { useState } from 'react';
import { askMentor } from '../services/api';

function ChatInterface({ taskId }) { // Changed prop from projectBrief to taskId
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const newMessages = [...messages, { sender: 'user', text: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    try {
      // Pass taskId and userInput to the updated askMentor function
      const mentorResponse = await askMentor(taskId, userInput);
      setMessages([...newMessages, { sender: 'mentor', text: mentorResponse }]);
    } catch (error) {
      console.error("Error asking mentor:", error);
      setMessages([...newMessages, { sender: 'mentor', text: "Sorry, I'm having trouble connecting. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <p>{msg.text}</p>
          </div>
        ))}
        {isLoading && <div className="message mentor"><p>Thinking...</p></div>}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask about the task..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatInterface;
