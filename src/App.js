import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import JoinRoom from './pages/JoinRoom';
import VideoCall from './pages/VideoCall';
import Login from './pages/Login';

function AppContent() {
  const [user, setUser] = useState(null);
  const location = useLocation();

  const isVideoCallPage = location.pathname.startsWith('/room/');

  useEffect(() => {
    // Check for existing user session
    const currentUser = localStorage.getItem('zynk_current_user');
    if (currentUser) {
      setUser(JSON.parse(currentUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('zynk_current_user');
    setUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {!isVideoCallPage && <Header user={user} onLogout={handleLogout} />}

      <main className={!isVideoCallPage ? 'flex-1' : ''}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/join" element={<JoinRoom user={user} />} />
          <Route path="/room/:roomName" element={<VideoCall />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </main>

      {!isVideoCallPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
