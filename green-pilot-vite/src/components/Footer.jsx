import React from 'react';
import '../App.css'; 
const Footer = () => {
  return (
    <footer className="footer">
      <p>&copy; {new Date().getFullYear()} Green Pilot. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
