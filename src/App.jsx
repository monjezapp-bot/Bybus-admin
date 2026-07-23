import React, { useState, useEffect, useCallback } from "react";
import {
  Bus, Users, MapPin, AlertTriangle, MessageCircle, School,
  LogOut, Settings, Home, Star, Receipt, Eye, EyeOff,
  Clock, CheckCircle2, RefreshCw, Loader2, AlertCircle
} from "lucide-react";
import { supabase } from "./supabaseClient";

/*
  Bybus — لوحة تحكم الإدارة
  =========================
  - الجلسة آمنة وتلقائية 100% عن طريق @supabase/supabase-js
    (تخزين آمن + تجديد تلقائي للـ Token)، مفيش أي تخزين مؤقت.
  - كل زر وكل رقم في الصفحة متصل فعلياً بقاعدة البيانات.
  - الأقسام اللي لسه ما اتبنتش موضّح عليها "قريباً" صراحةً بدل أزرار وهمية.
*/

const COLORS = {
  sun: "#FFC93C",
  sky: "#4FB6E8",
  mint: "#4ECDC4",
  orange: "#FF8C42",
  danger: "#EF4444",
};

const STATUS_LABELS = {
  scheduled: { label: "مجدولة", color: "#9CA3AF" },
  active: { label: "نشطة", color: COLORS.mint },
  completed: { label: "انتهت", color: "#9CA3AF" },
  delayed: { label: "متأخرة", color: COLORS.orange },
  cancelled: { label: "ملغاة", color: COLORS.danger },
};

const ALERT_LABELS = {
  sos: "استغاثة SOS",
  face_mismatch: "عدم تطابق صورة المشرفة",
  trip_delay: "تأخير رحلة",
  route_deviation: "خروج عن المسار",
  complaint: "شكوى",
  other: "تنبيه آخر",
};

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

function BybusMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="4" y="16" width="56" height="34" rx="14" fill={COLORS.sky} />
      <rect x="10" y="22" width="14" height="12" rx="4" fill="white" />
      <rect x="28" y="22" width="14" height="12" rx="4" fill="white" />
      <circle cx="18" cy="52" r="6" fill="#2D3436" />
      <circle cx="46" cy="52" r="6" fill="#2D3436" />
      <path d="M14 40 Q 20 46 26 40" stroke="#2D3436" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="15" cy="30" r="2" fill="#2D3436" />
      <circle cx="35" cy="30" r="2" fill="#2D3436" />
      <rect x="46" y="24" width="10" height="16" rx="4" fill={COLORS.sun} />
    </svg>
  );
}

/* ================= شاشة تسجيل الدخول ================= */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("من فضلك أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw new Error(`فشل تسجيل الدخول (رسالة السيرفر: ${authError.message})`);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, admin_permission")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب ليس حساب إدارة — لوحة التحكم دي متاحة لحسابات الإدارة فقط");
      }
      // مفيش حاجة تانية مطلوبة هنا — Supabase بتحدّث الجلسة تلقائياً
      // ومكوّن App هيلتقط التغيير عن طريق onAuthStateChange
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-3xl p-4 mb-3" style={{ backgroundColor: "#EAF6FC" }}>
            <BybusMark size={56} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Bybus</h1>
          <p className="text-gray-400 text-sm mt-1">لوحة تحكم الإدارة</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-600 mb-1.5">البريد الإلكتروني</label>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@bybus.app"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 mb-4 text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
          />

          <label className="block text-sm font-medium text-gray-600 mb-1.5">كلمة المرور</label>
          <div className="relative mb-6">
            <input
              type={showPw ? "text" : "password"}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-white font-semibold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: COLORS.orange }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "جارٍ التحقق..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          هذه اللوحة متاحة فقط لحسابات الإدارة المسجّلة مسبقاً
        </p>
      </div>
    </div>
  );
}

/* ================= عناصر مشتركة ================= */

function KpiCard({ icon: Icon, label, value, color, sub, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex-1 min-w-[160px]">
      <div className="rounded-xl p-2.5 w-fit mb-3" style={{ backgroundColor: color + "20" }}>
        <Icon size={20} color={color} />
      </div>
      <div className="text-2xl font-bold text-gray-800 h-8 flex items-center">
        {loading ? <Loader2 size={18} className="animate-spin text-gray-300" /> : value}
      </div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      {sub && !loading && (
        <div className="text-[11px] mt-1.5 font-medium" style={{ color }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, comingSoon }) {
  return (
    <button
      disabled={comingSoon}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active ? "text-white" : comingSoon ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-gray-50"
      }`}
      style={active ? { backgroundColor: COLORS.sky } : {}}
    >
      <Icon size={18} />
      <span className="flex-1 text-right">{label}</span>
      {comingSoon && (
        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-gray-100 text-gray-400">قريباً</span>
      )}
    </button>
  );
}

/* ================= الصفحة الرئيسية ================= */

function Dashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [trips, setTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [studentsTransported, setStudentsTransported] = useState(0);
  const [totalBuses, setTotalBuses] = useState(0);
  const [resolvingId, setResolvingId] = useState(null);

  const loadData = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const today = todayStr();

      const [tripsRes, alertsRes, busesRes, transportedRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id, trip_type, status, scheduled_time, started_at, ended_at, buses(bus_code, plate_number, profiles(full_name))")
          .eq("trip_date", today)
          .order("scheduled_time", { ascending: true }),
        supabase
          .from("alerts")
          .select("id, type, message, status, created_at, buses(bus_code)")
          .eq("status", "open")
          .order("created_at", { ascending: false }),
        supabase.from("buses").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("trip_students")
          .select("student_id, trips!inner(trip_date)")
          .eq("trips.trip_date", today)
          .in("status", ["boarded", "dropped_off"]),
      ]);

      if (tripsRes.error) throw tripsRes.error;
      if (alertsRes.error) throw alertsRes.error;
      if (busesRes.error) throw busesRes.error;
      if (transportedRes.error) throw transportedRes.error;

      setTrips(tripsRes.data || []);
      setAlerts(alertsRes.data || []);
      setTotalBuses(busesRes.count || 0);
      setStudentsTransported(new Set((transportedRes.data || []).map((r) => r.student_id)).size);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // تحديث لحظي حقيقي: أي تغيير في الرحلات أو التنبيهات يوصل فوراً
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => loadData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  async function handleResolveAlert(alertId) {
    setResolvingId(alertId);
    try {
      const { error: updateError } = await supabase
        .from("alerts")
        .update({ status: "resolved", resolved_by: profile.id, resolved_at: new Date().toISOString() })
        .eq("id", alertId);
      if (updateError) throw updateError;
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingId(null);
    }
  }

  const activeTripsCount = trips.filter((t) => t.status === "active").length;
  const activeBusesNow = new Set(trips.filter((t) => t.status === "active").map((t) => t.buses?.bus_code)).size;
  const initials = profile.full_name ? profile.full_name.trim().slice(0, 2) : "إد";

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      <aside className="w-64 bg-white border-l border-gray-100 flex flex-col p-4 shrink-0">
        <div className="flex items-center gap-2.5 px-2 mb-8 mt-2">
          <BybusMark size={34} />
          <span className="font-bold text-gray-800 text-lg">Bybus</span>
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem icon={Home} label="الرئيسية" active />
          <NavItem icon={Bus} label="الباصات" comingSoon />
          <NavItem icon={Users} label="الطلاب" comingSoon />
          <NavItem icon={School} label="المدارس" comingSoon />
          <NavItem icon={MapPin} label="الرحلات" comingSoon />
          <NavItem icon={MessageCircle} label="الدردشة" comingSoon />
          <NavItem icon={AlertTriangle} label="التنبيهات" comingSoon />
          <NavItem icon={Receipt} label="الاشتراكات" comingSoon />
          <NavItem icon={Star} label="التقييمات" comingSoon />
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          <NavItem icon={Settings} label="الإعدادات" comingSoon />
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-50"
          >
            <LogOut size={18} />
            <span className="flex-1 text-right">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">نظرة عامة</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              title="تحديث البيانات"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: COLORS.mint }}
              title={profile.full_name}
            >
              {initials}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-6">
          <KpiCard icon={Bus} label="حافلات نشطة الآن" value={activeBusesNow} color={COLORS.sky} sub={`من إجمالي ${totalBuses}`} loading={loading} />
          <KpiCard icon={MapPin} label="رحلات جارية" value={activeTripsCount} color={COLORS.mint} sub={`${trips.length} رحلة مجدولة اليوم`} loading={loading} />
          <KpiCard icon={Users} label="طلاب منقولون اليوم" value={studentsTransported} color={COLORS.sun} loading={loading} />
          <KpiCard icon={AlertTriangle} label="تنبيهات معلقة" value={alerts.length} color={COLORS.orange} sub={alerts.length > 0 ? "يحتاج مراجعة" : ""} loading={loading} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 text-sm">جدول الرحلات اليومية</h2>
              <span className="text-xs text-gray-400">{trips.length} رحلة</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-300">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : trips.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">مفيش رحلات مجدولة النهاردة</div>
            ) : (
              <div className="flex flex-col gap-2">
                {trips.map((t) => {
                  const statusInfo = STATUS_LABELS[t.status] || { label: t.status, color: "#9CA3AF" };
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50">
                      <div className="rounded-lg p-2" style={{ backgroundColor: COLORS.sky + "18" }}>
                        <Bus size={16} color={COLORS.sky} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-700">
                          {t.buses?.bus_code || "—"} · {t.trip_type === "morning" ? "ذهاب" : "عودة"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {t.buses?.profiles?.full_name || "بدون مشرفة"} · الموعد {t.scheduled_time?.slice(0, 5)}
                        </div>
                      </div>
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: statusInfo.color + "20", color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-4">التنبيهات الفورية</h2>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-300">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-xs text-gray-400 py-8 text-center">
                <CheckCircle2 size={20} color={COLORS.mint} />
                كل الرحلات تسير بشكل طبيعي، مفيش تنبيهات معلقة
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {alerts.map((a) => {
                  const isUrgent = a.type === "sos";
                  return (
                    <div
                      key={a.id}
                      className={`p-3 rounded-xl border ${isUrgent ? "border-red-100 bg-red-50" : "border-gray-100"}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} color={isUrgent ? COLORS.danger : COLORS.orange} />
                          <span className={`text-xs font-bold ${isUrgent ? "text-red-500" : "text-gray-700"}`}>
                            {ALERT_LABELS[a.type] || a.type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleResolveAlert(a.id)}
                          disabled={resolvingId === a.id}
                          className="text-[10px] font-bold text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                          {resolvingId === a.id ? <Loader2 size={12} className="animate-spin" /> : "تم الحل"}
                        </button>
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        <span>{a.buses?.bus_code || "—"}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(a.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ================= الجذر: بيدير الجلسة تلقائياً عن طريق Supabase ================= */

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = لسه بنتحقق
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadProfileForSession(currentSession) {
      if (!currentSession) {
        setSession(null);
        setProfile(null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, admin_permission")
        .eq("id", currentSession.user.id)
        .single();

      if (error || !data || data.role !== "admin") {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return;
      }
      setProfile(data);
      setSession(currentSession);
    }

    // بيتحقق من الجلسة المخزنة أول ما التطبيق يفتح (Auto Login الحقيقي)
    supabase.auth.getSession().then(({ data }) => loadProfileForSession(data.session));

    // بيتابع أي تغيير في الجلسة (دخول/خروج/تجديد تلقائي للـ Token)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      loadProfileForSession(currentSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-300 text-sm">جارٍ التحقق من الجلسة...</div>
      </div>
    );
  }

  return session && profile ? <Dashboard profile={profile} /> : <LoginScreen />;
}
