import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../../Styles/Login.css";

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "Staff"
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    console.log("Sign Up Data:", formData);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1>Inventory Management System</h1>
          <p className="subtitle">Create New Account</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="fullName"
                placeholder="Enter full name"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="Admin">Admin</option>
                <option value="Staff">Staff Member</option>
                <option value="Incharge">Inventory InCharge</option>
                <option value="hod">Head of the Department</option>
                <option value="dean">Dean</option>
                <option value="registrar">Registrar</option>
              </select>
            </div>

<           div className="form-group">
              <label>Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
              >
                <option value="deanOff">Dean's Office</option>
                <option value="it">Information Technology</option>
                <option value="cm">Computational Mathematics</option>
                <option value="ids">Interdisciplinary Studies</option>
                <option value="ugs">Undergratuate Studies</option>
                <option value="pgs">Postgraduate Studies</option>
              </select>
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="login-btn">
              Sign Up
            </button>
          </form>

          <p className="bottom-text">
            Already have an account?{" "}
            <Link to="/">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
