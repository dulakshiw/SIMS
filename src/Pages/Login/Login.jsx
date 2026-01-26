import React, { useState } from "react";
import "../../Styles/Login.css";
import { Link } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Email:", email);
    console.log("Password:", password);
  };

  return (
    
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1>Inventory Management System</h1><br></br>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-btn">
              Login
            </button>
              <h3><Link to="/forgotPassword">Forgot Password?</Link></h3><br></br>
              <h3><center><Link to="/Signup">Create New Account</Link></center></h3>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
