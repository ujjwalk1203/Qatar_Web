import { useOutletContext } from 'react-router-dom';

const labels = {
  "Maintenance access": "دخول للصيانة",
  "Dashboard": "لوحة المعلومات",
  "New reservation": "حجز جديد",
  "My requests": "طلباتي",
  "Network overview": "نظرة عامة على الشبكة",
  "Open network map": "فتح خريطة الشبكة",
  "Duct spans": "مقاطع القنوات",
  "Manholes": "غرف التفتيش",
  "Open requests": "الطلبات المفتوحة",
  "Available": "متاح",
  "Near limit": "قريب من حد السعة",
  "Full": "ممتلئ",
  "Locked": "مقفل",
  "Demo schematic": "مخطط تجريبي",
  "Network schematic": "مخطط الشبكة",
  "Workspaces": "مساحات العمل",
  "Recent requests": "أحدث الطلبات",
  "View all requests": "عرض جميع الطلبات",
  "Submitted requests will appear here.": "ستظهر الطلبات المقدمة هنا.",
  "Find ducts and manholes on the map.": "ابحث عن القنوات وغرف التفتيش على الخريطة.",
  "Inspect ducts, cable connections and splices.": "استعرض القنوات وتوصيلات الكابلات ووصلاتها.",
  "Check capacity and submit a reservation.": "تحقق من السعة وقدّم طلب حجز.",
  "Review sign-ins, decisions and overrides.": "راجع عمليات تسجيل الدخول والقرارات والتجاوزات.",
  "Send test requests and inspect responses.": "أرسل طلبات اختبار واستعرض الاستجابات.",
  "Loading workspace…": "جارٍ تحميل مساحة العمل…",
  "Try again": "إعادة المحاولة",
  "No matching requests.": "لا توجد طلبات مطابقة.",
  "Export details": "تصدير التفاصيل",
  "Duct space & splice reservation": "حجز مساحة القنوات ووصلات الكابلات",
  "Operator": "المشغّل",
  "Cable type": "نوع الكابل",
  "Cable count": "عدد الكابلات",
  "Planned splices": "الوصلات المخطط لها",
  "Splice location": "موقع الوصلة",
  "Comments": "ملاحظات",
  "Created": "تاريخ الإنشاء",
  "Submitted": "مقدّم",
  "Under review": "قيد المراجعة",
  "Reserved": "محجوز",
  "Rejected": "مرفوض",
  "Revision required": "مطلوب تعديل",
  "Omar Al Mukhtar St": "شارع عمر المختار",
  "Al Wahda St": "شارع الوحدة",
  "Duct network schematic": "مخطط شبكة القنوات",
  "Select ": "تحديد "
};

export function useLanguage() {
  const arabic = useOutletContext()?.arabic === true;
  return { arabic, t: (label) => arabic ? (labels[label] ?? label) : label };
}

