import React, { useState, useEffect } from 'react';
import SkillSelector from './components/SkillSelector';
import CurrentTask from './components/CurrentTask';
import WelcomeScreen from './components/WelcomeScreen';
import { getCurrentTask, startNewTask, completeTask } from './services/api';
import './App.css';

function App() {
  const [currentTask, setCurrentTask] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcomeScreen(false);
    }, 3000);

    const fetchCurrentTask = async () => {
      setIsLoading(true); // Start loading
      try {
        const task = await getCurrentTask();
        setCurrentTask(task);
      } catch (error) {
        console.error("Error fetching current task:", error);
      } finally {
        setIsLoading(false); // Finish loading
      }
    };
    fetchCurrentTask();

    return () => clearTimeout(timer);
  }, []);

  const handleSkillSelect = async (skill) => {
    setIsLoading(true);
    try {
      const newTask = await startNewTask(skill);
      setCurrentTask(newTask);
    } catch (error) {
      console.error("Error starting new task:", error);
      alert(error.response?.data?.detail || "Failed to start new task.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskComplete = async (taskId, deliverableUrl) => {
    setIsLoading(true);
    try {
      await completeTask(taskId, deliverableUrl);
      setCurrentTask(null); // This will automatically switch the view
    } catch (error) {
      console.error("Error completing task:", error);
      alert(error.response?.data?.detail || "Failed to complete task.");
    } finally {
      setIsLoading(false);
    }
  };

  // This function is no longer needed as we removed the summary view
  // const toggleCurrentTaskView = () => { ... };

  if (isLoading) {
    return <div className="App"><h1>Loading...</h1></div>;
  }

  if (showWelcomeScreen) {
    return <div className="App"><WelcomeScreen /></div>;
  }

  return (
    <div className="App">
      <h1>Portfolio Builder AI Agent</h1>
      {currentTask ? (
        <CurrentTask 
          task={currentTask} 
          onTaskComplete={handleTaskComplete} 
          // The back to dashboard button is now effectively a "go back to skill selector"
          // which means we just need to set the current task to null.
          // We will adjust the CurrentTask component to handle this.
          onBackToDashboard={() => setCurrentTask(null)} 
        />
      ) : (
        <SkillSelector onSkillSelect={handleSkillSelect} />
      )}
    </div>
  );
}

export default App;