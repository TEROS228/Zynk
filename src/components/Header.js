import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = ({ user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 border-b border-indigo-500/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 cursor-pointer group relative"
          >
            {/* Energy Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 rounded-xl blur-xl opacity-0 group-hover:opacity-75 transition-opacity duration-300 animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>

            <img
              src="/logo.png"
              alt="Zynk Logo"
              className="h-16 w-auto relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]"
            />
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => navigate('/')}
              className="text-gray-200 hover:text-white transition-colors font-medium"
            >
              Home
            </button>
            <button
              onClick={() => navigate('/join')}
              className="text-gray-200 hover:text-white transition-colors font-medium"
            >
              Join
            </button>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-indigo-300">{user.email}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="px-4 py-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-colors text-sm font-medium border border-red-500/30"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-indigo-500/30"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
