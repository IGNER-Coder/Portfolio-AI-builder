import React, { useState, useEffect } from 'react';
import { getAvailableSkills } from '../services/api';

// Helper to format the skill key into a nice title
const formatSkillName = (skillKey) => {
  return skillKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

function SkillSelector({ onSkillSelect }) {
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const availableSkills = await getAvailableSkills();
        setSkills(availableSkills);
      } catch (err) {
        setError('Could not load skills. Please refresh the page.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkills();
  }, []);

  if (isLoading) {
    return <div className="skill-selector"><h2>Loading skills...</h2></div>;
  }

  if (error) {
    return <div className="skill-selector"><h2 className="error-message">{error}</h2></div>;
  }

  return (
    <div className="skill-selector">
      <h2>Select a Skill to Start a New Task</h2>
      {skills.length > 0 ? (
        <div className="skill-grid">
          {skills.map(skill => (
            <div key={skill} className="skill-card" onClick={() => onSkillSelect(skill)}>
              <h3>{formatSkillName(skill)}</h3>
              <p>Click to start a new {formatSkillName(skill)} task.</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No skills are currently configured. Please add a skill in the admin dashboard.</p>
      )}
    </div>
  );
}

export default SkillSelector;
