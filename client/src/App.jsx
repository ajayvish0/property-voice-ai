import React, { useState, useEffect } from 'react';
import { useVoice } from './hooks/useVoice.js';
import HomePage from './pages/HomePage.jsx';
import VoicePage from './pages/VoicePage.jsx';
import ScorePage from './pages/ScorePage.jsx';

export default function App() {
  const [page, setPage] = useState('home');
  const voice = useVoice();

  useEffect(() => {
    if (voice.score) setPage('score');
  }, [voice.score]);

  function handleStart() {
    voice.reset();
    setPage('voice');
    setTimeout(() => voice.connect(), 80);
  }

  function handleBack() {
    voice.reset();
    setPage('home');
  }

  if (page === 'home') return <HomePage onStart={handleStart} />;
  if (page === 'voice') return <VoicePage voice={voice} onBack={handleBack} />;
  if (page === 'score') return <ScorePage score={voice.score} onRestart={handleBack} />;
}
