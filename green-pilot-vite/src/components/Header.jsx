import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../App.css";

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext); // <-- read `user` too

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="header">
      <h1 className="logo">🌿 GreenPilot</h1>
      <nav className="nav">
        <Link to="/">Home</Link>
        {user && <Link to="/create-job">Create Job</Link>}
        {user && <Link to="/job-history">Job History</Link>}

        {!user ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Signup</Link>
          </>
        ) : (
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        )}
      </nav>
    </header>
  );
};

export default Header;
