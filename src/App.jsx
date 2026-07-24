import React, { useState, useEffect, useCallback } from "react";
import {
  Bus, Users, MapPin, AlertTriangle, MessageCircle, School,
  LogOut, Settings, Home, Star, Receipt, Eye, EyeOff,
  Clock, CheckCircle2, RefreshCw, Loader2, AlertCircle, UserCog
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

function NavItem({ icon: Icon, label, active, comingSoon, onClick }) {
  return (
    <button
      disabled={comingSoon}
      onClick={onClick}
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

/* ================= قسم الباصات ================= */

function AddBusModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    supervisor_email: "",
    supervisor_password: "",
    supervisor_full_name: "",
    supervisor_phone: "",
    plate_number: "",
    vehicle_model: "",
    vehicle_capacity: "",
    driver_name: "",
    driver_phone: "",
    company_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const requiredOk =
    form.supervisor_email && form.supervisor_password && form.supervisor_full_name && form.plate_number && form.driver_name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!requiredOk) {
      setError("لازم تملأ كل الحقول الأساسية: بريد وكلمة مرور واسم المشرفة، رقم اللوحة، واسم السائق");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create_supervisor_account", {
        body: {
          ...form,
          vehicle_capacity: form.vehicle_capacity ? Number(form.vehicle_capacity) : null,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      onCreated();
    } catch (err) {
      setError(err.message || "حصل خطأ غير متوقع أثناء إنشاء الباص");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-base">إضافة باص جديد (حساب المشرفة + السائق + المركبة)</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <div className="text-xs font-bold text-gray-400 mb-2">بيانات المشرفة (حساب الدخول)</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>اسم المشرفة</label>
                <input className={inputClass} value={form.supervisor_full_name} onChange={(e) => update("supervisor_full_name", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>البريد الإلكتروني</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.supervisor_email} onChange={(e) => update("supervisor_email", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>كلمة مرور مؤقتة</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.supervisor_password} onChange={(e) => update("supervisor_password", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>رقم تليفون المشرفة</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.supervisor_phone} onChange={(e) => update("supervisor_phone", e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-gray-400 mb-2">بيانات المركبة</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>رقم اللوحة</label>
                <input className={inputClass} value={form.plate_number} onChange={(e) => update("plate_number", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>الموديل</label>
                <input className={inputClass} value={form.vehicle_model} onChange={(e) => update("vehicle_model", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>السعة (عدد الطلاب)</label>
                <input type="number" dir="ltr" className={inputClass + " text-left"} value={form.vehicle_capacity} onChange={(e) => update("vehicle_capacity", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>اسم شركة الباص</label>
                <input className={inputClass} value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-gray-400 mb-2">بيانات السائق (بيانات فقط، بدون دخول للتطبيق)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>اسم السائق</label>
                <input className={inputClass} value={form.driver_name} onChange={(e) => update("driver_name", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>رقم تليفون السائق</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.driver_phone} onChange={(e) => update("driver_phone", e.target.value)} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: COLORS.orange }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "جارٍ الإنشاء..." : "إنشاء الباص"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CopyableField({ label, value, dir = "ltr" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // بعض المتصفحات بتمنع النسخ من غير تفاعل مباشر؛ الفشل هنا غير حرج
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <div dir={dir} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 truncate">
          {value || "—"}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40 shrink-0"
        >
          {copied ? "اتنسخت ✓" : "نسخ"}
        </button>
      </div>
    </div>
  );
}

const pinIcon = new L.DivIcon({
  html: '<div style="font-size:30px;line-height:30px;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.3))">📍</div>',
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function LocationPicker({ lat, lng, onChange }) {
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const cairoCenter = [30.0444, 31.2357]; // نقطة بداية افتراضية (القاهرة) لحد ما يتحدد موقع فعلي

  function handleLinkSubmit() {
    setLinkError("");
    if (!linkInput.trim()) return;
    const patterns = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/];
    for (const p of patterns) {
      const m = linkInput.match(p);
      if (m) {
        onChange(parseFloat(m[1]), parseFloat(m[2]));
        setLinkInput("");
        return;
      }
    }
    setLinkError("مقدرتش أفهم اللينك ده. جرب تدوس على المكان في الخريطة مباشرة بدل كده");
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">الموقع على الخريطة</label>
      <div className="flex gap-2 mb-2">
        <input
          dir="ltr"
          placeholder="أو الصق رابط Google Maps هنا"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <button
          type="button"
          onClick={handleLinkSubmit}
          className="rounded-xl px-3 text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: COLORS.sky }}
        >
          تحديد
        </button>
      </div>
      {linkError && <div className="text-[11px] text-red-500 mb-2">{linkError}</div>}

      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 220 }}>
        <MapContainer center={lat != null && lng != null ? [lat, lng] : cairoCenter} zoom={lat != null && lng != null ? 15 : 6} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onPick={onChange} />
          {lat != null && lng != null && <Marker position={[lat, lng]} icon={pinIcon} />}
          <MapRecenter lat={lat} lng={lng} />
        </MapContainer>
      </div>

      <div className="text-[11px] text-gray-400 mt-1.5">
        {lat != null && lng != null ? `الموقع المحدد: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "دوس على المكان بالظبط في الخريطة لتحديد الموقع"}
      </div>
    </div>
  );
}

function BusDetailModal({ busId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bus, setBus] = useState(null);
  const [form, setForm] = useState(null);
  const [availableSupervisors, setAvailableSupervisors] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const [schedule, setSchedule] = useState({}); // { [dayIndex]: { morning: "07:00", evening: "14:00" } }
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data, error: fetchError } = await supabase
          .from("buses")
          .select(
            "id, bus_code, plate_number, vehicle_model, vehicle_capacity, vehicle_license_number, vehicle_license_expiry, company_name, is_active, supervisor_id, driver_employee_id, profiles(id, full_name, phone, email), driver:employees!driver_employee_id(id, full_name, phone, license_number, license_expiry, employee_code)"
          )
          .eq("id", busId)
          .single();
        if (fetchError) throw fetchError;
        setBus(data);
        setForm({
          plate_number: data.plate_number || "",
          vehicle_model: data.vehicle_model || "",
          vehicle_capacity: data.vehicle_capacity ?? "",
          vehicle_license_number: data.vehicle_license_number || "",
          vehicle_license_expiry: data.vehicle_license_expiry || "",
          driver_name: data.driver?.full_name || "",
          driver_phone: data.driver?.phone || "",
          driver_license_number: data.driver?.license_number || "",
          driver_license_expiry: data.driver?.license_expiry || "",
          company_name: data.company_name || "",
          supervisor_full_name: data.profiles?.full_name || "",
          supervisor_phone: data.profiles?.phone || "",
        });

        // موظفين متاحين للاستبدال بالـ ID (مشرفات احتياطية مالهاش باص، سائقين متاحين)
        const [supervisorsRes, driversRes] = await Promise.all([
          supabase
            .from("employee_current_assignment")
            .select("employee_id, employee_code, full_name")
            .eq("employee_type", "supervisor")
            .eq("employment_status", "available")
            .is("assigned_bus_id", null),
          supabase
            .from("employee_current_assignment")
            .select("employee_id, employee_code, full_name")
            .eq("employee_type", "driver")
            .eq("employment_status", "available")
            .is("assigned_bus_id", null),
        ]);
        setAvailableSupervisors(supervisorsRes.data || []);
        setAvailableDrivers(driversRes.data || []);

        const { data: scheduleRows, error: scheduleError } = await supabase
          .from("bus_shift_schedules")
          .select("day_of_week, trip_type, scheduled_time")
          .eq("bus_id", busId);
        if (scheduleError) throw scheduleError;
        const scheduleMap = {};
        (scheduleRows || []).forEach((r) => {
          scheduleMap[r.day_of_week] = scheduleMap[r.day_of_week] || {};
          scheduleMap[r.day_of_week][r.trip_type] = r.scheduled_time?.slice(0, 5);
        });
        setSchedule(scheduleMap);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [busId]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: busError } = await supabase
        .from("buses")
        .update({
          plate_number: form.plate_number,
          vehicle_model: form.vehicle_model || null,
          vehicle_capacity: form.vehicle_capacity ? Number(form.vehicle_capacity) : null,
          vehicle_license_number: form.vehicle_license_number || null,
          vehicle_license_expiry: form.vehicle_license_expiry || null,
          company_name: form.company_name || null,
        })
        .eq("id", busId);
      if (busError) throw busError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: form.supervisor_full_name,
          phone: form.supervisor_phone || null,
        })
        .eq("id", bus.supervisor_id);
      if (profileError) throw profileError;

      const { error: driverError } = await supabase
        .from("employees")
        .update({
          full_name: form.driver_name,
          phone: form.driver_phone || null,
          license_number: form.driver_license_number || null,
          license_expiry: form.driver_license_expiry || null,
        })
        .eq("id", bus.driver_employee_id);
      if (driverError) throw driverError;

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reassignSupervisor(newProfileId) {
    if (!newProfileId) return;
    setReassigning(true);
    setError("");
    try {
      const { error: updateError } = await supabase.from("buses").update({ supervisor_id: newProfileId }).eq("id", busId);
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setReassigning(false);
    }
  }

  async function reassignDriver(newEmployeeId) {
    if (!newEmployeeId) return;
    setReassigning(true);
    setError("");
    try {
      const { error: updateError } = await supabase.from("buses").update({ driver_employee_id: newEmployeeId }).eq("id", busId);
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setReassigning(false);
    }
  }

  function updateScheduleTime(dayIndex, tripType, time) {
    setSchedule((prev) => ({
      ...prev,
      [dayIndex]: { ...prev[dayIndex], [tripType]: time },
    }));
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    setError("");
    try {
      const upserts = [];
      const deletions = [];
      for (let day = 0; day <= 6; day++) {
        for (const tripType of ["morning", "evening"]) {
          const time = schedule[day]?.[tripType];
          if (time) {
            upserts.push({ bus_id: busId, day_of_week: day, trip_type: tripType, scheduled_time: time, is_active: true });
          } else {
            deletions.push({ day, tripType });
          }
        }
      }

      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("bus_shift_schedules")
          .upsert(upserts, { onConflict: "bus_id,trip_type,day_of_week" });
        if (upsertError) throw upsertError;
      }

      // حذف أي موعد اتشال من الفورم (كان موجود قبل كده وبقى فاضي)
      for (const d of deletions) {
        await supabase
          .from("bus_shift_schedules")
          .delete()
          .eq("bus_id", busId)
          .eq("day_of_week", d.day)
          .eq("trip_type", d.tripType);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-base">{loading ? "جارٍ التحميل..." : `تفاصيل ${bus?.bus_code}`}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <>
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div>
              <div className="text-xs font-bold text-gray-400 mb-2">بيانات المشرفة</div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className={labelClass}>الاسم</label>
                  <input className={inputClass} value={form.supervisor_full_name} onChange={(e) => update("supervisor_full_name", e.target.value)} />
                </div>
                <CopyableField label="البريد الإلكتروني (حساب الدخول)" value={bus.profiles?.email} />
                <div>
                  <label className={labelClass}>رقم التليفون</label>
                  <input dir="ltr" className={inputClass + " text-left"} value={form.supervisor_phone} onChange={(e) => update("supervisor_phone", e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-gray-400 mb-2">بيانات المركبة</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>رقم اللوحة</label>
                  <input className={inputClass} value={form.plate_number} onChange={(e) => update("plate_number", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>الموديل</label>
                  <input className={inputClass} value={form.vehicle_model} onChange={(e) => update("vehicle_model", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>السعة</label>
                  <input type="number" dir="ltr" className={inputClass + " text-left"} value={form.vehicle_capacity} onChange={(e) => update("vehicle_capacity", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>شركة الباص</label>
                  <input className={inputClass} value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>رقم رخصة المركبة</label>
                  <input dir="ltr" className={inputClass + " text-left"} value={form.vehicle_license_number} onChange={(e) => update("vehicle_license_number", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>تاريخ انتهاء رخصة المركبة</label>
                  <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.vehicle_license_expiry} onChange={(e) => update("vehicle_license_expiry", e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-gray-400 mb-2">بيانات السائق</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <CopyableField label="كود الموظف (السائق)" value={bus.driver?.employee_code} dir="ltr" />
                </div>
                <div>
                  <label className={labelClass}>الاسم</label>
                  <input className={inputClass} value={form.driver_name} onChange={(e) => update("driver_name", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>رقم التليفون</label>
                  <input dir="ltr" className={inputClass + " text-left"} value={form.driver_phone} onChange={(e) => update("driver_phone", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>رقم رخصة القيادة</label>
                  <input dir="ltr" className={inputClass + " text-left"} value={form.driver_license_number} onChange={(e) => update("driver_license_number", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>تاريخ انتهاء رخصة القيادة</label>
                  <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.driver_license_expiry} onChange={(e) => update("driver_license_expiry", e.target.value)} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ backgroundColor: COLORS.orange }}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>

            <div className="border-t border-gray-100 mt-5 pt-5 flex flex-col gap-4">
              <div className="text-xs font-bold text-gray-400">استبدال بموظف موجود بالفعل (بالـ ID)</div>

              <div>
                <label className={labelClass}>استبدال المشرفة (من المشرفات الاحتياطية المتاحة)</label>
                <select
                  disabled={reassigning}
                  defaultValue=""
                  onChange={(e) => e.target.value && reassignSupervisor(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    {availableSupervisors.length === 0 ? "مفيش مشرفات احتياطية متاحة دلوقتي" : "اختر مشرفة بديلة..."}
                  </option>
                  {availableSupervisors.map((s) => (
                    <option key={s.employee_id} value={s.employee_id}>
                      {s.employee_code} · {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>استبدال السائق (من السائقين المتاحين)</label>
                <select
                  disabled={reassigning}
                  defaultValue=""
                  onChange={(e) => e.target.value && reassignDriver(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    {availableDrivers.length === 0 ? "مفيش سائقين متاحين دلوقتي" : "اختر سائق بديل..."}
                  </option>
                  {availableDrivers.map((d) => (
                    <option key={d.employee_id} value={d.employee_id}>
                      {d.employee_code} · {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {reassigning && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> جارٍ تنفيذ الاستبدال...
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 mt-5 pt-5">
              <div className="text-xs font-bold text-gray-400 mb-3">
                مواعيد الرحلات الأسبوعية (منها بيتولد جدول اليوم تلقائياً كل يوم)
              </div>
              <div className="flex flex-col gap-2">
                {["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((dayName, dayIndex) => (
                  <div key={dayIndex} className="grid grid-cols-3 items-center gap-2">
                    <span className="text-xs text-gray-500">{dayName}</span>
                    <input
                      type="time"
                      dir="ltr"
                      value={schedule[dayIndex]?.morning || ""}
                      onChange={(e) => updateScheduleTime(dayIndex, "morning", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-left"
                      title="ذهاب"
                    />
                    <input
                      type="time"
                      dir="ltr"
                      value={schedule[dayIndex]?.evening || ""}
                      onChange={(e) => updateScheduleTime(dayIndex, "evening", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-left"
                      title="عودة"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                <span></span>
                <span>ذهاب</span>
                <span>عودة</span>
              </div>
              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="w-full rounded-xl py-2.5 text-sm font-semibold mt-3 flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ backgroundColor: COLORS.sky, color: "white" }}
              >
                {savingSchedule && <Loader2 size={14} className="animate-spin" />}
                {savingSchedule ? "جارٍ الحفظ..." : "حفظ المواعيد"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BusesPage({ profile, avatar }) {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const loadBuses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("buses")
        .select("id, bus_code, plate_number, vehicle_model, company_name, is_active, profiles(full_name), driver:employees!driver_employee_id(full_name)")
        .order("bus_code", { ascending: true });
      if (fetchError) throw fetchError;
      setBuses(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBuses();
  }, [loadBuses]);

  async function toggleActive(bus) {
    setTogglingId(bus.id);
    try {
      const { error: updateError } = await supabase.from("buses").update({ is_active: !bus.is_active }).eq("id", bus.id);
      if (updateError) throw updateError;
      setBuses((prev) => prev.map((b) => (b.id === bus.id ? { ...b, is_active: !b.is_active } : b)));
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">الباصات</h1>
          <p className="text-sm text-gray-400 mt-0.5">{buses.length} باص مسجّل</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl px-4 py-2.5 text-white text-sm font-semibold"
            style={{ backgroundColor: COLORS.orange }}
          >
            + إضافة باص جديد
          </button>
          {avatar}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : buses.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">مفيش باصات مسجّلة لسه — دوس "إضافة باص جديد" عشان تبدأ</div>
        ) : (
          <div className="flex flex-col gap-2">
            {buses.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBusId(b.id)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                <div className="rounded-lg p-2" style={{ backgroundColor: COLORS.sky + "18" }}>
                  <Bus size={16} color={COLORS.sky} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-700">
                    {b.bus_code} · {b.plate_number}
                    {b.vehicle_model ? ` · ${b.vehicle_model}` : ""}
                  </div>
                  <div className="text-xs text-gray-400">
                    المشرفة: {b.profiles?.full_name || "—"} · السائق: {b.driver?.full_name || "—"}
                    {b.company_name ? ` · ${b.company_name}` : ""}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleActive(b);
                  }}
                  disabled={togglingId === b.id}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full disabled:opacity-50"
                  style={{
                    backgroundColor: b.is_active ? COLORS.mint + "20" : "#9CA3AF20",
                    color: b.is_active ? COLORS.mint : "#6B7280",
                  }}
                >
                  {togglingId === b.id ? <Loader2 size={12} className="animate-spin" /> : b.is_active ? "نشط" : "متوقف"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddBusModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadBuses();
          }}
        />
      )}

      {selectedBusId && (
        <BusDetailModal
          busId={selectedBusId}
          onClose={() => setSelectedBusId(null)}
          onSaved={() => {
            setSelectedBusId(null);
            loadBuses();
          }}
        />
      )}
    </div>
  );
}

/* ================= قسم الموظفين ================= */

const EMPLOYEE_TYPE_LABELS = {
  supervisor: "مشرفة",
  driver: "سائق",
  admin_staff: "إدارة",
};

const EMPLOYMENT_STATUS_LABELS = {
  available: { label: "متاح", color: COLORS.mint },
  on_leave: { label: "في إجازة", color: COLORS.orange },
  terminated: { label: "منتهي الخدمة", color: "#9CA3AF" },
};

function AddEmployeeModal({ onClose, onCreated }) {
  const [empType, setEmpType] = useState("driver");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    national_id: "",
    license_number: "",
    license_expiry: "",
    email: "",
    password: "",
    admin_permission: "support",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.full_name) {
      setError("اسم الموظف مطلوب");
      return;
    }
    if (empType !== "driver" && (!form.email || !form.password)) {
      setError("البريد الإلكتروني وكلمة المرور مطلوبين لأي حساب بيسجل دخول");
      return;
    }

    setSaving(true);
    try {
      if (empType === "driver") {
        // السائق: بيانات فقط، بدون حساب دخول - إدراج مباشر
        const { error: insertError } = await supabase.from("employees").insert({
          employee_type: "driver",
          job_title: "سائق",
          full_name: form.full_name,
          phone: form.phone || null,
          national_id: form.national_id || null,
          license_number: form.license_number || null,
          license_expiry: form.license_expiry || null,
        });
        if (insertError) throw insertError;
      } else if (empType === "supervisor") {
        // مشرفة احتياطية بدون باص - عن طريق نفس الـ Edge Function، بدون بيانات باص
        const { data, error: fnError } = await supabase.functions.invoke("create_supervisor_account", {
          body: {
            supervisor_email: form.email,
            supervisor_password: form.password,
            supervisor_full_name: form.full_name,
            supervisor_phone: form.phone || null,
          },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
      } else {
        // موظف إداري - عن طريق Edge Function مخصصة (متاحة للمدير العام فقط)
        const { data, error: fnError } = await supabase.functions.invoke("create_admin_account", {
          body: {
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone || null,
            admin_permission: form.admin_permission,
          },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
      }
      onCreated();
    } catch (err) {
      setError(err.message || "حصل خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-base">إضافة موظف جديد</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        <div className="flex gap-2 mb-5">
          {[
            { key: "driver", label: "سائق" },
            { key: "supervisor", label: "مشرفة احتياطية" },
            { key: "admin_staff", label: "موظف إدارة" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setEmpType(t.key)}
              className="flex-1 rounded-xl py-2 text-xs font-bold border"
              style={
                empType === t.key
                  ? { backgroundColor: COLORS.sky, color: "white", borderColor: COLORS.sky }
                  : { borderColor: "#E5E7EB", color: "#6B7280" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>الاسم الكامل</label>
            <input className={inputClass} value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>رقم التليفون</label>
            <input dir="ltr" className={inputClass + " text-left"} value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>

          {empType === "driver" && (
            <>
              <div>
                <label className={labelClass}>الرقم القومي</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.national_id} onChange={(e) => update("national_id", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>رقم رخصة القيادة</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.license_number} onChange={(e) => update("license_number", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>تاريخ انتهاء الرخصة</label>
                <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.license_expiry} onChange={(e) => update("license_expiry", e.target.value)} />
              </div>
            </>
          )}

          {empType !== "driver" && (
            <>
              <div>
                <label className={labelClass}>البريد الإلكتروني (حساب الدخول)</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>كلمة مرور مؤقتة</label>
                <input dir="ltr" className={inputClass + " text-left"} value={form.password} onChange={(e) => update("password", e.target.value)} />
              </div>
            </>
          )}

          {empType === "admin_staff" && (
            <div>
              <label className={labelClass}>المسمى الوظيفي</label>
              <select className={inputClass} value={form.admin_permission} onChange={(e) => update("admin_permission", e.target.value)}>
                <option value="support">مسؤول دعم فني</option>
                <option value="operations">مسؤول تشغيل</option>
                <option value="general_manager">مدير عام</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
            style={{ backgroundColor: COLORS.orange }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "جارٍ الإنشاء..." : "إضافة الموظف"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmployeeDetailModal({ employeeId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [employee, setEmployee] = useState(null);
  const [form, setForm] = useState(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: "", end_date: "", reason: "" });
  const [savingLeave, setSavingLeave] = useState(false);

  const loadEmployee = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("employees")
        .select(
          "id, employee_code, employee_type, job_title, employment_status, full_name, phone, phone_secondary, national_id, license_number, license_expiry, hire_date, contract_end_date, notes, profiles(email)"
        )
        .eq("id", employeeId)
        .single();
      if (fetchError) throw fetchError;
      setEmployee(data);
      setForm({
        full_name: data.full_name || "",
        phone: data.phone || "",
        phone_secondary: data.phone_secondary || "",
        national_id: data.national_id || "",
        license_number: data.license_number || "",
        license_expiry: data.license_expiry || "",
        hire_date: data.hire_date || "",
        contract_end_date: data.contract_end_date || "",
        notes: data.notes || "",
        employment_status: data.employment_status,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          full_name: form.full_name,
          phone: form.phone || null,
          phone_secondary: form.phone_secondary || null,
          national_id: form.national_id || null,
          license_number: form.license_number || null,
          license_expiry: form.license_expiry || null,
          hire_date: form.hire_date || null,
          contract_end_date: form.contract_end_date || null,
          notes: form.notes || null,
          employment_status: form.employment_status,
        })
        .eq("id", employeeId);
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitLeave(e) {
    e.preventDefault();
    if (!leaveForm.start_date || !leaveForm.end_date) {
      setError("لازم تحدد تاريخ بداية ونهاية الإجازة");
      return;
    }
    setSavingLeave(true);
    setError("");
    try {
      const { error: leaveError } = await supabase.from("leave_requests").insert({
        employee_id: employeeId,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason || null,
        status: "approved", // الإدارة هي اللي بتسجلها مباشرة، فبتُعتمد فوراً وتُفعّل التنبيه التلقائي
        reviewed_at: new Date().toISOString(),
      });
      if (leaveError) throw leaveError;
      setShowLeaveForm(false);
      setLeaveForm({ start_date: "", end_date: "", reason: "" });
      loadEmployee();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLeave(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-base">
            {loading ? "جارٍ التحميل..." : `${employee?.employee_code} · ${employee?.job_title || EMPLOYEE_TYPE_LABELS[employee?.employee_type]}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {employee.profiles?.email && <CopyableField label="البريد الإلكتروني (حساب الدخول)" value={employee.profiles.email} />}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>الاسم الكامل</label>
                  <input className={inputClass} value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>رقم التليفون</label>
                  <input dir="ltr" className={inputClass + " text-left"} value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>رقم تليفون بديل</label>
                  <input dir="ltr" className={inputClass + " text-left"} value={form.phone_secondary} onChange={(e) => update("phone_secondary", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>الرقم القومي</label>
                  <input dir="ltr" className={inputClass + " text-left"} value={form.national_id} onChange={(e) => update("national_id", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>الحالة</label>
                  <select className={inputClass} value={form.employment_status} onChange={(e) => update("employment_status", e.target.value)}>
                    <option value="available">متاح</option>
                    <option value="on_leave">في إجازة</option>
                    <option value="terminated">منتهي الخدمة</option>
                  </select>
                </div>
                {employee.employee_type === "driver" && (
                  <>
                    <div>
                      <label className={labelClass}>رقم رخصة القيادة</label>
                      <input dir="ltr" className={inputClass + " text-left"} value={form.license_number} onChange={(e) => update("license_number", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>تاريخ انتهاء الرخصة</label>
                      <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.license_expiry} onChange={(e) => update("license_expiry", e.target.value)} />
                    </div>
                  </>
                )}
                <div>
                  <label className={labelClass}>تاريخ التعيين</label>
                  <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.hire_date} onChange={(e) => update("hire_date", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>تاريخ انتهاء العقد</label>
                  <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.contract_end_date} onChange={(e) => update("contract_end_date", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>ملاحظات</label>
                  <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ backgroundColor: COLORS.orange }}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            </form>

            <div className="border-t border-gray-100 mt-5 pt-5">
              {!showLeaveForm ? (
                <button
                  onClick={() => setShowLeaveForm(true)}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  + تسجيل إجازة معتمدة
                </button>
              ) : (
                <form onSubmit={handleSubmitLeave} className="flex flex-col gap-3">
                  <div className="text-xs font-bold text-gray-400">
                    تسجيل الإجازة هيحدّث حالة الموظف تلقائياً، ولو مرتبط بباص هيتبعت تنبيه للإدارة فوراً
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>من تاريخ</label>
                      <input type="date" dir="ltr" className={inputClass + " text-left"} value={leaveForm.start_date} onChange={(e) => setLeaveForm((p) => ({ ...p, start_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>إلى تاريخ</label>
                      <input type="date" dir="ltr" className={inputClass + " text-left"} value={leaveForm.end_date} onChange={(e) => setLeaveForm((p) => ({ ...p, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>السبب (اختياري)</label>
                    <input className={inputClass} value={leaveForm.reason} onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLeaveForm(false)}
                      className="flex-1 rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-500"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={savingLeave}
                      className="flex-1 rounded-xl py-2.5 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                      style={{ backgroundColor: COLORS.sky }}
                    >
                      {savingLeave && <Loader2 size={14} className="animate-spin" />}
                      اعتماد الإجازة
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmployeesPage({ avatar }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("employees")
        .select("id, employee_code, employee_type, job_title, employment_status, full_name, phone")
        .order("employee_code", { ascending: true });
      if (fetchError) throw fetchError;
      setEmployees(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filtered = employees.filter((emp) => {
    const matchesType = typeFilter === "all" || emp.employee_type === typeFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || emp.full_name.toLowerCase().includes(q) || emp.employee_code?.toLowerCase().includes(q) || (emp.phone || "").includes(q);
    return matchesType && matchesSearch;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">الموظفين</h1>
          <p className="text-sm text-gray-400 mt-0.5">{employees.length} موظف مسجّل</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl px-4 py-2.5 text-white text-sm font-semibold"
            style={{ backgroundColor: COLORS.orange }}
          >
            + إضافة موظف
          </button>
          {avatar}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="بحث بالاسم، الكود، أو رقم التليفون"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
        >
          <option value="all">كل الأنواع</option>
          <option value="supervisor">مشرفات</option>
          <option value="driver">سائقين</option>
          <option value="admin_staff">إدارة</option>
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">مفيش نتائج مطابقة</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((emp) => {
              const statusInfo = EMPLOYMENT_STATUS_LABELS[emp.employment_status] || { label: emp.employment_status, color: "#9CA3AF" };
              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  <div className="rounded-lg p-2" style={{ backgroundColor: COLORS.sun + "25" }}>
                    <Users size={16} color="#B7791F" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-700">
                      {emp.employee_code} · {emp.full_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {emp.job_title || EMPLOYEE_TYPE_LABELS[emp.employee_type]}
                      {emp.phone ? ` · ${emp.phone}` : ""}
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

      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadEmployees();
          }}
        />
      )}

      {selectedEmployeeId && (
        <EmployeeDetailModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
          onSaved={() => {
            setSelectedEmployeeId(null);
            loadEmployees();
          }}
        />
      )}
    </div>
  );
}

/* ================= قسم المدارس ================= */

function SchoolModal({ school, onClose, onSaved }) {
  const isEdit = Boolean(school);
  const [form, setForm] = useState({
    name: school?.name || "",
    address_text: school?.address_text || "",
    location_lat: school?.location_lat ?? "",
    location_lng: school?.location_lng ?? "",
    phone: school?.phone || "",
    whatsapp_number: school?.whatsapp_number || "",
    external_apply_url: school?.external_apply_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.location_lat || !form.location_lng) {
      setError("اسم المدرسة والإحداثيات (خط الطول والعرض) مطلوبين لحساب المسافات بدقة");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        address_text: form.address_text || null,
        location_lat: Number(form.location_lat),
        location_lng: Number(form.location_lng),
        phone: form.phone || null,
        whatsapp_number: form.whatsapp_number || null,
        external_apply_url: form.external_apply_url || null,
      };
      const { error: saveError } = isEdit
        ? await supabase.from("schools").update(payload).eq("id", school.id)
        : await supabase.from("schools").insert(payload);
      if (saveError) throw saveError;
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-base">{isEdit ? "تعديل بيانات المدرسة" : "إضافة مدرسة جديدة"}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>اسم المدرسة</label>
            <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>العنوان (نص وصفي)</label>
            <input className={inputClass} value={form.address_text} onChange={(e) => update("address_text", e.target.value)} />
          </div>
          <LocationPicker
            lat={form.location_lat === "" ? null : Number(form.location_lat)}
            lng={form.location_lng === "" ? null : Number(form.location_lng)}
            onChange={(newLat, newLng) => {
              update("location_lat", newLat);
              update("location_lng", newLng);
            }}
          />
          <div>
            <label className={labelClass}>رقم تليفون المدرسة</label>
            <input dir="ltr" className={inputClass + " text-left"} value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>رقم واتساب (للتواصل بخصوص التقديم)</label>
            <input dir="ltr" className={inputClass + " text-left"} value={form.whatsapp_number} onChange={(e) => update("whatsapp_number", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>رابط خارجي للتقديم (اختياري)</label>
            <input dir="ltr" className={inputClass + " text-left"} value={form.external_apply_url} onChange={(e) => update("external_apply_url", e.target.value)} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
            style={{ backgroundColor: COLORS.orange }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المدرسة"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SchoolsPage({ avatar }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalSchool, setModalSchool] = useState(undefined); // undefined = مقفول، null = إضافة، object = تعديل

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("schools")
        .select("id, name, address_text, location_lat, location_lng, phone, whatsapp_number, is_active")
        .order("name", { ascending: true });
      if (fetchError) throw fetchError;
      setSchools(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">المدارس</h1>
          <p className="text-sm text-gray-400 mt-0.5">{schools.length} مدرسة مسجّلة</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalSchool(null)}
            className="rounded-xl px-4 py-2.5 text-white text-sm font-semibold"
            style={{ backgroundColor: COLORS.orange }}
          >
            + إضافة مدرسة
          </button>
          {avatar}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : schools.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">مفيش مدارس مسجّلة لسه — دوس "إضافة مدرسة" عشان تبدأ</div>
        ) : (
          <div className="flex flex-col gap-2">
            {schools.map((s) => (
              <div
                key={s.id}
                onClick={() => setModalSchool(s)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                <div className="rounded-lg p-2" style={{ backgroundColor: COLORS.mint + "18" }}>
                  <School size={16} color={COLORS.mint} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-700">{s.name}</div>
                  <div className="text-xs text-gray-400">{s.address_text || "بدون عنوان نصي"}{s.phone ? ` · ${s.phone}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalSchool !== undefined && (
        <SchoolModal
          school={modalSchool}
          onClose={() => setModalSchool(undefined)}
          onSaved={() => {
            setModalSchool(undefined);
            loadSchools();
          }}
        />
      )}
    </div>
  );
}

/* ================= قسم الطلاب ================= */

function StudentModal({ onClose, onCreated }) {
  const [parentQuery, setParentQuery] = useState("");
  const [parentResults, setParentResults] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [searching, setSearching] = useState(false);
  const [schools, setSchools] = useState([]);
  const [buses, setBuses] = useState([]);
  const [form, setForm] = useState({
    full_name: "",
    grade: "",
    school_id: "",
    bus_id: "",
    home_lat: "",
    home_lng: "",
    home_address_text: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOptions() {
      const [schoolsRes, busesRes] = await Promise.all([
        supabase.from("schools").select("id, name").order("name"),
        supabase.from("buses").select("id, bus_code, plate_number").eq("is_active", true).order("bus_code"),
      ]);
      setSchools(schoolsRes.data || []);
      setBuses(busesRes.data || []);
    }
    loadOptions();
  }, []);

  async function searchParent() {
    if (!parentQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const { data, error: searchError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email")
        .eq("role", "parent")
        .or(`email.ilike.%${parentQuery}%,phone.ilike.%${parentQuery}%,full_name.ilike.%${parentQuery}%`)
        .limit(5);
      if (searchError) throw searchError;
      setParentResults(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedParent) {
      setError("لازم تختار ولي الأمر الأول (ابحث بالبريد أو رقم التليفون)");
      return;
    }
    if (!form.full_name || !form.school_id) {
      setError("اسم الطالب والمدرسة مطلوبين");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from("students").insert({
        parent_id: selectedParent.id,
        school_id: form.school_id,
        bus_id: form.bus_id || null,
        full_name: form.full_name,
        grade: form.grade || null,
        home_lat: form.home_lat ? Number(form.home_lat) : null,
        home_lng: form.home_lng ? Number(form.home_lng) : null,
        home_address_text: form.home_address_text || null,
      });
      if (insertError) throw insertError;
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-base">تسجيل طالب جديد</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4">
          <label className={labelClass}>البحث عن ولي الأمر (بريد إلكتروني أو تليفون أو اسم)</label>
          <div className="flex gap-2">
            <input
              dir="ltr"
              className={inputClass + " text-left"}
              value={parentQuery}
              onChange={(e) => setParentQuery(e.target.value)}
              placeholder="ابحث..."
            />
            <button
              type="button"
              onClick={searchParent}
              disabled={searching}
              className="rounded-xl px-4 text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: COLORS.sky }}
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : "بحث"}
            </button>
          </div>

          {parentResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {parentResults.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setSelectedParent(p);
                    setParentResults([]);
                    setParentQuery(p.full_name);
                  }}
                  className="text-right rounded-xl border border-gray-200 p-2.5 text-xs hover:bg-gray-50"
                >
                  <div className="font-semibold text-gray-700">{p.full_name}</div>
                  <div className="text-gray-400" dir="ltr">{p.email || p.phone}</div>
                </button>
              ))}
            </div>
          )}

          {selectedParent && (
            <div className="mt-2 rounded-xl bg-sky-50 border border-sky-100 p-2.5 text-xs text-sky-700">
              ✓ ولي الأمر المختار: {selectedParent.full_name}
            </div>
          )}

          {parentResults.length === 0 && !selectedParent && !searching && (
            <div className="mt-2 text-[11px] text-gray-400">
              لو مفيش نتايج، معناه ولي الأمر لسه مسجّلش في التطبيق (لازم يسجّل من تطبيق ولي الأمر الأول).
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>اسم الطالب</label>
            <input className={inputClass} value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>الصف الدراسي</label>
            <input className={inputClass} value={form.grade} onChange={(e) => update("grade", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>المدرسة</label>
            <select className={inputClass} value={form.school_id} onChange={(e) => update("school_id", e.target.value)}>
              <option value="">اختر المدرسة...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>الباص (اختياري دلوقتي)</label>
            <select className={inputClass} value={form.bus_id} onChange={(e) => update("bus_id", e.target.value)}>
              <option value="">بدون تحديد باص الآن</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>{b.bus_code} · {b.plate_number}</option>
              ))}
            </select>
          </div>
          <LocationPicker
            lat={form.home_lat === "" ? null : Number(form.home_lat)}
            lng={form.home_lng === "" ? null : Number(form.home_lng)}
            onChange={(newLat, newLng) => {
              update("home_lat", newLat);
              update("home_lng", newLng);
            }}
          />
          <div>
            <label className={labelClass}>عنوان المنزل (نص وصفي)</label>
            <input className={inputClass} value={form.home_address_text} onChange={(e) => update("home_address_text", e.target.value)} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
            style={{ backgroundColor: COLORS.orange }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "جارٍ التسجيل..." : "تسجيل الطالب"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentsPage({ avatar }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("students")
        .select("id, full_name, grade, is_active, profiles(full_name), schools(name), buses(bus_code)")
        .order("full_name", { ascending: true });
      if (fetchError) throw fetchError;
      setStudents(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">الطلاب</h1>
          <p className="text-sm text-gray-400 mt-0.5">{students.length} طالب مسجّل</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl px-4 py-2.5 text-white text-sm font-semibold"
            style={{ backgroundColor: COLORS.orange }}
          >
            + تسجيل طالب
          </button>
          {avatar}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">مفيش طلاب مسجّلين لسه — دوس "تسجيل طالب" عشان تبدأ</div>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50">
                <div className="rounded-lg p-2" style={{ backgroundColor: COLORS.sun + "25" }}>
                  <Users size={16} color="#B7791F" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-700">
                    {s.full_name}{s.grade ? ` · ${s.grade}` : ""}
                  </div>
                  <div className="text-xs text-gray-400">
                    ولي الأمر: {s.profiles?.full_name || "—"} · {s.schools?.name || "بدون مدرسة"}
                    {s.buses?.bus_code ? ` · ${s.buses.bus_code}` : " · بدون باص"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <StudentModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadStudents();
          }}
        />
      )}
    </div>
  );
}

/* ================= الصفحة الرئيسية ================= */

function Dashboard({ profile }) {
  const [page, setPage] = useState("home");
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
          <NavItem icon={Home} label="الرئيسية" active={page === "home"} onClick={() => setPage("home")} />
          <NavItem icon={Bus} label="الباصات" active={page === "buses"} onClick={() => setPage("buses")} />
          <NavItem icon={UserCog} label="الموظفين" active={page === "employees"} onClick={() => setPage("employees")} />
          <NavItem icon={Users} label="الطلاب" active={page === "students"} onClick={() => setPage("students")} />
          <NavItem icon={School} label="المدارس" active={page === "schools"} onClick={() => setPage("schools")} />
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
        {page === "buses" ? (
          <BusesPage
            profile={profile}
            avatar={
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ backgroundColor: COLORS.mint }}
                title={profile.full_name}
              >
                {initials}
              </div>
            }
          />
        ) : page === "employees" ? (
          <EmployeesPage
            avatar={
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ backgroundColor: COLORS.mint }}
                title={profile.full_name}
              >
                {initials}
              </div>
            }
          />
        ) : page === "schools" ? (
          <SchoolsPage
            avatar={
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ backgroundColor: COLORS.mint }}
                title={profile.full_name}
              >
                {initials}
              </div>
            }
          />
        ) : page === "students" ? (
          <StudentsPage
            avatar={
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ backgroundColor: COLORS.mint }}
                title={profile.full_name}
              >
                {initials}
              </div>
            }
          />
        ) : (
          <>
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
          </>
        )}
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
