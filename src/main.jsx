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
import UserManagement from './Pages/Admin/UserManagement'
import Reports from './Pages/Admin/Reports'
import Profile from './Pages/Admin/Profile'

// Inventory Pages
import InventoryDashboard from './Pages/Inventory/InchargeDashboard'
import InventoryListView from './Pages/Inventory/InventoryListView'
import AddNewItem from './Pages/Inventory/AddNewItem'
import InchargeDashboard from './Pages/Inventory/InchargeDashboard'
import ItemView from './Pages/Inventory/ItemView'

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

// Staff Pages
import StaffDashboard from './Pages/StaffMember/StaffDashboard'

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
      }
    ]
  },

  // ==================== Inventory Routes ====================
  {
    path: "/inventory",
    children: [
      {
        path: "dashboard",
        element: <InchargeDashboard />
      },
        {
          path: "scan",
          element: <ItemView />
        },
      {
        path: "list",
        element: <InventoryListView />
      },
      {
        path: "add",
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
          }
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
            path: "new",
            element: <CreateDisposal />
          },
          {
            path: ":disposalId",
            element: <DisposalDetails />
          },
          {
            path: "reports",
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
            path: "new",
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

  // ==================== Requests & Approvals Routes ====================
  {
    path: "/requests",
    children: [
      {
        path: "approval",
        element: <ItemRequest />
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

  // ==================== Incharge Routes ====================
  {
    path: "/incharge",
    children: [
      {
        path: "dashboard",
        element: <InchargeDashboard />
      }
    ]
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
