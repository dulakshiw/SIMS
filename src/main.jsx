import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './Pages/Login/Login';
import StaffDashboard from './Pages/StaffMember/StaffDashboard';
import AdminDashboard from './Pages/Admin/AdminDashboard';
import SignUp from './Pages/Login/SIgnUp';
import ForgotPW from './Pages/Login/ForgotPW';
import AddNewItem from './Pages/Inventory/AddNewItem';
import InchargeDashboard from './Pages/Inventory/InchargeDashboard';

const router= createBrowserRouter(
[
  {
    path:"/",
    element:<Login/>
  },
  {
    path:"/signup",
    element:<SignUp/>
  },
  {
    path:"/forgotPassword",
    element:<ForgotPW/>
  },
  {
    path:"/admin/dashboard",
    element:<AdminDashboard/>
  },
  {
    path:"/staff/dashboard",
    element:<StaffDashboard/>
  },
  {
    path:"/AddNewItem",
    element:<AddNewItem/>
  },
  {
    path:"/Incharge/dashboard",
    element:<InchargeDashboard/>
  }
]
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router}></RouterProvider>
  </StrictMode>,
)
