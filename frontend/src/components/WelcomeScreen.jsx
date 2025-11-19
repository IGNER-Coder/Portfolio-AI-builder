import React, { useState, useEffect } from 'react';
import SkillSelector from './SkillSelector';

function WelcomeScreen() {
  const [showSkills, setShowSkills] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkills(true);
    }, 1000); // Delay before skills animate in
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="welcome-container">
      <h1 className="welcome-message">Welcome, Sensei!</h1>
      {showSkills && (
        <div className={'skill-selector animate-in'}>
          <h2>Choose Your Path</h2>
          {/* SkillSelector will be rendered here by App.jsx, but we need the animation class */}
        </div>
      )}
    </div>
  );
}

export default WelcomeScreen;
