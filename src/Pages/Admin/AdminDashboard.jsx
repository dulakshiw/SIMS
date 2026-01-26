import React from 'react'
import AdminSidebar from '../../Components/Admin/AdminSidebar'
import Header from '../../Components/Header'
import Footer from '../../Components/Footer'
import "../../Styles/AdminDashboard.css";


const AdminDashboard=() => {
return (
    <div>
        <Header/>
        <div className="dashboard-layout">
            <AdminSidebar/>
            <div className="dashboard-content">
            
                <div className="summary-cards">
                    <div className="card">
                        <h3>Total Users</h3>
                        <p className="card-number">50</p>
                    </div>

                    <div className="card">
                        <h3>Active Users</h3>
                        <p className="card-number">30</p>
                    </div>

                    <div className="card">
                        <h3>Inventories</h3>
                        <p className="card-number">12</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

}
export default AdminDashboard