import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000', // Default to localhost for development
});

export const getAvailableSkills = async () => {
  try {
    const response = await api.get('/skills');
    return response.data.skills;
  } catch (error) {
    console.error("Error fetching skills:", error);
    throw error;
  }
};

export const getCurrentTask = async () => {
  const response = await api.get('/task/current');
  return response.data.task;
};

export const startNewTask = async (skill) => {
  const response = await api.post('/task/start', { skill });
  return response.data.task;
};

export const completeTask = async (taskId, deliverableUrl) => {
  const response = await api.post('/task/complete', { task_id: taskId, deliverable_url: deliverableUrl });
  return response.data;
};

export const askMentor = async (taskId, question) => {
  const response = await api.post('/task/chat', { task_id: taskId, question: question });
  return response.data.answer;
};

export const rateCode = async (taskId, code) => {
  const response = await api.post('/task/rate_code', { task_id: taskId, code: code });
  return response.data;
};
