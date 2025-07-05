import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import History from './pages/History';
import Signup from './pages/Signup';
import Login from './pages/Login';
import CreateJob from './pages/CreateJob'; 
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <div className="app-wrapper">
        <Router>
          <Header />
          <main className="app-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/job-history" element={<History />} />
              <Route path="/create-job" element={<CreateJob />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </main>
          <Footer />
        </Router>
      </div>
    </AuthProvider>
  );
}

export default App;
