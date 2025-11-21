import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = ({ user }) => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sessionName, setSessionName] = useState('');

  const handleCreateSession = (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to create a session!');
      navigate('/login');
      return;
    }

    if (!sessionName.trim()) {
      alert('Please enter a session name!');
      return;
    }

    localStorage.setItem('userName', user.name);

    setShowCreateModal(false);
    const roomName = sessionName.trim().toLowerCase().replace(/\s+/g, '-');
    setSessionName('');
    navigate(`/room/${roomName}`);
  };

  const handleJoinSession = (e) => {
    e.preventDefault();

    if (!sessionName.trim()) {
      alert('Please enter a session name!');
      return;
    }

    const nameToUse = user?.name || 'Guest';
    localStorage.setItem('userName', nameToUse);

    setShowJoinModal(false);
    const roomName = sessionName.trim().toLowerCase().replace(/\s+/g, '-');
    setSessionName('');
    navigate(`/room/${roomName}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Lightning Icon */}
            <div className="inline-flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-xl opacity-75 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-4 rounded-2xl">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Hero Text */}
            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 mb-6 animate-gradient">
              Zynk
            </h1>
            <p className="text-2xl md:text-3xl text-gray-700 font-bold mb-4">
              Lightning-fast Video Calls ⚡
            </p>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
              Connect with friends and colleagues instantly. No registration, no waiting. Just energy and speed.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <button
                onClick={() => {
                  if (!user) {
                    alert('Please sign in to create a session!');
                    navigate('/login');
                    return;
                  }
                  setShowCreateModal(true);
                }}
                className="group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/50 hover:shadow-indigo-500/70 hover:scale-105 transform"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Session
                </span>
              </button>

              <button
                onClick={() => setShowJoinModal(true)}
                className="px-8 py-4 bg-white border-2 border-indigo-600 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all hover:scale-105 transform shadow-lg"
              >
                Join Session
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div>
                <div className="text-3xl font-black text-indigo-600 mb-1">{'< 1sec'}</div>
                <div className="text-sm text-gray-600">Connection</div>
              </div>
              <div>
                <div className="text-3xl font-black text-purple-600 mb-1">HD</div>
                <div className="text-sm text-gray-600">Quality</div>
              </div>
              <div>
                <div className="text-3xl font-black text-indigo-600 mb-1">∞</div>
                <div className="text-sm text-gray-600">Participants</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">
              Why Zynk?
            </h2>
            <p className="text-xl text-gray-600">
              Energy. Speed. Convenience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group relative bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 hover:shadow-2xl transition-all hover:scale-105 transform">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Lightning Fast</h3>
                <p className="text-gray-600">
                  Connect in less than a second. No waiting, just action.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 hover:shadow-2xl transition-all hover:scale-105 transform">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Crystal Clear Quality</h3>
                <p className="text-gray-600">
                  HD video and clear audio. See and hear every detail.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 hover:shadow-2xl transition-all hover:scale-105 transform">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">100% Secure</h3>
                <p className="text-gray-600">
                  Encrypted P2P connection. Your conversations stay yours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Ready to Connect?
          </h2>
          <p className="text-xl text-indigo-100 mb-10">
            Create a room right now and feel the power of instant connection
          </p>
          <button
            onClick={() => {
              if (!user) {
                alert('Please sign in to create a session!');
                navigate('/login');
                return;
              }
              setShowCreateModal(true);
            }}
            className="px-10 py-5 bg-white text-indigo-600 font-black text-lg rounded-xl hover:bg-gray-100 transition-all shadow-2xl hover:scale-105 transform"
          >
            Create Session ⚡
          </button>
        </div>
      </section>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-scale-in">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setSessionName('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center mb-4">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg shadow-indigo-500/50">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Session</h3>
              <p className="text-gray-600">Choose a name for your video session</p>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  required
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                  placeholder="e.g. Team Meeting"
                />
                <p className="text-xs text-gray-500 mt-2">You can share the link with participants</p>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/50"
              >
                Create and Join
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Session Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-scale-in">
            <button
              onClick={() => {
                setShowJoinModal(false);
                setSessionName('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center mb-4">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg shadow-indigo-500/50">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Join Session</h3>
              <p className="text-gray-600">Enter the session name to connect</p>
            </div>

            <form onSubmit={handleJoinSession} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  required
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                  placeholder="e.g. team-meeting"
                />
                <p className="text-xs text-gray-500 mt-2">Or just follow the link you were sent</p>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/50"
              >
                Join Session
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
