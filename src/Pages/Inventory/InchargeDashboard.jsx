import React from 'react'
import Header from '../../Components/Header'
import Footer from '../../Components/Footer'
import InchargeSidebar from '../../Components/Incharge/InchargeSidebar'

const InchargeDashboard=() => {
const username = "Incharge"; // later from login / token

return (
    <div>
       <Header username={username}/>
       <Footer/>
       <InchargeSidebar/>
        <h1>Inventory Incharge Dashboard</h1>
    </div>
)

}
export default InchargeDashboard



