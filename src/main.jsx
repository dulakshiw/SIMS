import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

// Auth Pages - Using existing pages
import Login from './Pages/Login/Login'
import SignUp from './Pages/Login/SIgnUp'
import ForgotPW from './Pages/Login/ForgotPW'
import ResetPassword from './Pages/Login/ResetPassword'

// Admin Pages
import AdminDashboard from './Pages/Admin/AdminDashboard'
import AdminPendingTasks from './Pages/Admin/AdminPendingTasks'
import UserManagement from './Pages/Admin/UserManagement'
import Reports from './Pages/Admin/Reports'
import Profile from './Pages/Admin/Profile'

// Inventory Pages
import InventoryListView from './Pages/Inventory/InventoryListView'
import AddNewItem from './Pages/Inventory/AddNewItem'
import ItemView from './Pages/Inventory/ItemView'
import ItemDetail from './Pages/Inventory/ItemDetail'

// Disposal Pages
import DisposalList from './Pages/Inventory/Disposals/DisposalList'
import CreateDisposal from './Pages/Inventory/Disposals/CreateDisposal'
import DisposalDetails from './Pages/Inventory/Disposals/DisposalDetails'
import DisposalReports from './Pages/Inventory/Disposals/DisposalReports'

// Transfer Pages
import TransferList from './Pages/Inventory/Transfers/TransferList'
import TransferDetails from './Pages/Inventory/Transfers/TransferDetails'

// Request Pages
import RequestList from './Pages/Inventory/Requests/RequestList'
import CreateRequest from './Pages/Inventory/Requests/CreateRequest'
import ItemRequest from './Pages/Requests/ItemRequest'
import MyRequests from './Pages/Requests/MyRequests'

// Staff Pages
import StaffDashboard from './Pages/StaffMember/StaffDashboard'
import HodDashboard from './Pages/StaffMember/HodDashboard'
import DeanDashboard from './Pages/StaffMember/DeanDashboard'
import DepartmentManagement from './Pages/Admin/DepartmentManagement'
import InventoryManagement from './Pages/Admin/InventoryManagement'

const router = createBrowserRouter([
  // ==================== Authentication Routes ====================
  {
    path: "/",
    element: <Login />
  },
  {
    path: "/signup",
    element: <SignUp />
  },
  {
    path: "/forgotPassword",
    element: <ForgotPW />
  },
  {
    path: "/resetPassword",
    element: <ResetPassword />
  },

  // ==================== Admin Routes ====================
  {
    path: "/admin",
    children: [
      {
        path: "dashboard",
        element: <AdminDashboard />
      },
      {
        path: "profile",
        element: <Profile />
      },
      {
        path: "users",
        element: <UserManagement />
      },
      {
        path: "reports",
        element: <Reports />
      },
      {
        path: "departments",
        element: <DepartmentManagement />
      },
      {
        path: "inventory",
        element: <InventoryManagement />
      },
      {
        path: "pending-tasks",
        element: <AdminPendingTasks />
      }
    ]
  },

  // ==================== Inventory Routes ====================
  {
    path: "/inventory",
    children: [
      {
        path: "dashboard",
        element: <StaffDashboard />
      },
      {
        path: "scan",
        element: <ItemView />
      },
      {
        path: "scan/:role",
        element: <ItemView />
      },
      {
        path: "item/:id",
        element: <ItemDetail />
      },
      {
        path: "item/:id/:role",
        element: <ItemDetail />
      },
      {
        path: "list",
        element: <InventoryListView />
      },
      {
        path: "list/:role",
        element: <InventoryListView />
      },
      {
        path: "add",
        element: <AddNewItem />
      },
      {
        path: "add/:role",
        element: <AddNewItem />
      },
      {
        path: "transfers",
        children: [
          {
            path: "list",
            element: <TransferList />
          },
          {
            path: ":transferId",
            element: <TransferDetails />
          },
        ]
      },
      {
        path: "disposals",
        children: [
          {
            path: "list",
            element: <DisposalList />
          },
          {
            path: "list/:role",
            element: <DisposalList />
          },
          {
            path: "new",
            element: <CreateDisposal />
          },
          {
            path: "new/:role",
            element: <CreateDisposal />
          },
          {
            path: ":disposalId",
            element: <DisposalDetails />
          },
          {
            path: ":disposalId/:role",
            element: <DisposalDetails />
          },
          {
            path: "reports",
            element: <DisposalReports />
          },
          {
            path: "reports/:role",
            element: <DisposalReports />
          }
        ]
      },
      {
        path: "requests",
        children: [
          {
            path: "list",
            element: <RequestList />
          },
          {
            path: "list/:role",
            element: <RequestList />
          },
          {
            path: "new",
            element: <CreateRequest />
          },
          {
            path: "new/:role",
            element: <CreateRequest />
          }
        ]
      }
    ]
  },

  // ==================== Shared Profile Route ====================
  {
    path: "/profile",
    element: <Profile />
  },
  {
    path: "/profile/:role",
    element: <Profile />
  },

  // ==================== Shared Reports Route ====================
  {
    path: "/reports/:role",
    element: <Reports layoutVariant="main" />
  },

  // ==================== Requests & Approvals Routes ====================
  {
    path: "/requests",
    children: [
      {
        path: "approval",
        element: <ItemRequest />
      },
      {
        path: "approval/:role",
        element: <ItemRequest />
      },
      {
        path: "my/:role",
        element: <MyRequests />
      }
    ]
  },

  // ==================== Staff Routes ====================
  {
    path: "/staff",
    children: [
      {
        path: "dashboard",
        element: <StaffDashboard />
      }
    ]
  },

  // ==================== HOD Routes ====================
  {
    path: "/hod",
    children: [
      {
        path: "dashboard",
        element: <HodDashboard />
      }
    ]
  },

  // ==================== Dean Routes ====================
  {
    path: "/dean",
    children: [
      {
        path: "dashboard",
        element: <DeanDashboard />
      }
    ]
  },

])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
