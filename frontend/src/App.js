import { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";

// Pages
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import MeetingCreate from "@/pages/MeetingCreate";
import MeetingView from "@/pages/MeetingView";
import MeetingLive from "@/pages/MeetingLive";
import Tasks from "@/pages/Tasks";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

// Components
import Layout from "@/components/Layout";
import AuthCallback from "@/components/AuthCallback";
import ProtectedRoute from "@/components/ProtectedRoute";

function AppRouter() {
  const location = useLocation();
  
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Check URL fragment for session_id synchronously (prevents race conditions)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/meetings/new" element={
        <ProtectedRoute>
          <Layout><MeetingCreate /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/meetings/:id" element={
        <ProtectedRoute>
          <Layout><MeetingView /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/meetings/:id/live" element={
        <ProtectedRoute>
          <Layout><MeetingLive /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <Layout><Tasks /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <Layout><Reports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout><Settings /></Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-background">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
