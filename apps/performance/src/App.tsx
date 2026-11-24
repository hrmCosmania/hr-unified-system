import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { HOST, hosted, supabase } from "./lib/supabase";
import { StoreProvider, useStore } from "./data/store";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Goals from "./pages/Goals";
import CheckinPage from "./pages/Checkin";
import FeedbackPage from "./pages/Feedback";
import Review from "./pages/Review";
import Feedback360 from "./pages/Feedback360";
import Career from "./pages/Career";
import Idp from "./pages/Idp";
import Team from "./pages/Team";
import Calibration from "./pages/Calibration";
import Analytics from "./pages/Analytics";
import Admin from "./pages/Admin";
import type { Role } from "./data/types";

function Guard({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { signedIn, role } = useStore();
  if (!signedIn) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** ล็อกอินเดียวกับระบบ HR: ยังไม่ล็อกอิน → ไปหน้าล็อกอินของระบบ HR แล้วกลับมา · ล็อกอินแล้ว → เข้าแอปเลย (มุมมอง HR) */
function HostGate({ children }: { children: ReactNode }) {
  const { signedIn, signIn } = useStore();
  const [ready, setReady] = useState(!hosted);
  useEffect(() => {
    if (!hosted || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        location.replace(HOST.login + "?next=" + encodeURIComponent("/performance/" + location.hash));
        return;
      }
      if (!signedIn) signIn("hr");
      setReady(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ready ? <>{children}</> : null;
}

export default function App() {
  return (
    <StoreProvider>
      <HostGate>
      <HashRouter>
        <Routes>
          <Route path="/login" element={hosted ? <Navigate to="/" replace /> : <Login />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route index element={<Home />} />
            <Route path="goals" element={<Goals />} />
            <Route path="checkin" element={<CheckinPage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="review" element={<Review />} />
            <Route path="360" element={<Feedback360 />} />
            <Route path="career" element={<Career />} />
            <Route path="idp" element={<Idp />} />
            <Route path="team" element={<Guard roles={["manager", "hr"]}><Team /></Guard>} />
            <Route path="calibration" element={<Guard roles={["hr"]}><Calibration /></Guard>} />
            <Route path="analytics" element={<Guard roles={["hr"]}><Analytics /></Guard>} />
            <Route path="admin" element={<Guard roles={["hr"]}><Admin /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      </HostGate>
    </StoreProvider>
  );
}
