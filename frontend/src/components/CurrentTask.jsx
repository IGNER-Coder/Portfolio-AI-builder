import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown'; // Import the markdown component
import ChatInterface from './ChatInterface';
import { rateCode } from '../services/api';

function CurrentTask({ task, onTaskComplete, onBackToDashboard }) {
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [codeToReview, setCodeToReview] = useState('');
  const [isRatingCode, setIsRatingCode] = useState(false);
  const [codeRating, setCodeRating] = useState(null);

  const handleSubmit = () => {
    if (deliverableUrl) {
      onTaskComplete(task.id, deliverableUrl);
    }
  };

  const handleCodeReview = async () => {
    if (!codeToReview.trim()) return;
    setIsRatingCode(true);
    setCodeRating(null);
    try {
      const response = await rateCode(task.id, codeToReview);
      setCodeRating(response.rating);
    } catch (error) {
      console.error("Error rating code:", error);
      setCodeRating("Failed to get code review. Please try again.");
    } finally {
      setIsRatingCode(false);
    }
  };

  return (
    <div className="current-task">
      <div className="task-header">
        <h2>Current Task: {task.skill}</h2>
        <button onClick={onBackToDashboard} className="back-to-dashboard-button">
          ← Back to Dashboard
        </button>
      </div>
      
      {/* Use ReactMarkdown to render the project brief */}
      <div className="project-brief-display">
        <ReactMarkdown>{task.project_brief}</ReactMarkdown>
      </div>
      
      <div className="task-actions">
        <input
          type="text"
          placeholder="Paste Deliverable URL (e.g., GitHub Repo)"
          value={deliverableUrl}
          onChange={(e) => setDeliverableUrl(e.target.value)}
        />
        <button onClick={handleSubmit}>Complete & Submit Task</button>
      </div>

      <div className="chat-toggle">
        <button onClick={() => setShowChat(!showChat)}>
          {showChat ? 'Hide Discussion' : 'Discuss Task with AI Mentor'}
        </button>
      </div>

      {showChat && <ChatInterface taskId={task.id} />}

      <div className="code-review-section">
        <h3>Get a Code Review (Optional)</h3>
        <p>Before you submit, get feedback on your code from the AI mentor.</p>
        <textarea
          placeholder="Paste your code here or provide a public GitHub Gist/Repo URL..."
          rows="6"
          value={codeToReview}
          onChange={(e) => setCodeToReview(e.target.value)}
        ></textarea>
        <button onClick={handleCodeReview} disabled={isRatingCode}>
          {isRatingCode ? 'Analyzing Code...' : 'Get Feedback'}
        </button>
        {codeRating && (
          <div className="code-rating-result">
            <h4>AI Code Review:</h4>
            {/* Also render the code rating with markdown */}
            <ReactMarkdown>{codeRating}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default CurrentTask;
