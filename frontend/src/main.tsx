import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ApiError } from './api/client'
import { AuthProvider } from './auth'
import { Layout } from './components/Layout'
import { EmptyState } from './components/States'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RatedPage } from './pages/RatedPage'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retrying a 4xx won't change the answer; network errors and 5xx get one retry.
      retry: (count, error) =>
        error instanceof ApiError && error.status >= 400 && error.status < 500 ? false : count < 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/rated', element: <RatedPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/avaliados', element: <Navigate to="/rated" replace /> },
      { path: '*', element: <EmptyState title="This page doesn't exist" /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
