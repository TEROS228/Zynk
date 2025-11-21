import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const JoinRoom = ({ user }) => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState(user?.name || '');

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomName.trim()) {
      const finalRoomName = roomName.trim().toLowerCase().replace(/\s+/g, '-');
      const nameToUse = user?.name || userName.trim() || 'Guest';
      localStorage.setItem('userName', nameToUse);
      navigate(`/room/${finalRoomName}`);
    }
  };

  const handleCreateRoom = () => {
    const randomRoom = `room-${Math.random().toString(36).substring(2, 9)}`;
    const nameToUse = user?.name || userName.trim() || 'Guest';
    localStorage.setItem('userName', nameToUse);
    navigate(`/room/${randomRoom}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            {/* Lightning Icon */}
            <div className="inline-flex items-center justify-center mb-4">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg shadow-indigo-500/50">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
              Join a Call
            </h2>
            <p className="text-gray-600">Instant connection in a second ⚡</p>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-white/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. team-meeting"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-white/50"
              />
            </div>

            <button
              type="submit"
              disabled={!roomName.trim()}
              className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Join Room
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/80 text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            className="w-full px-6 py-4 bg-white text-indigo-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl border-2 border-indigo-200 hover:border-indigo-300 transform hover:scale-[1.02] transition-all duration-200"
          >
            <span className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Call ⚡
            </span>
          </button>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>You can share the room link with other participants</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
