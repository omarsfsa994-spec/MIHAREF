
const SUPABASE_URL = "https://rnjesgjtjsbaxyafklsu.supabase.co";
const SUPABASE_KEY = "sb_publishable_hVLMaDbWG-iAaQCImWDmJA_ht04LPbY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (selector) => document.querySelector(selector);

let currentUser = null;
let currentProfile = null;

function showNotice(message) {
  $("#notice").textContent = message;
}

function setLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = loading;
}

async function ensureProfile(user) {
  const { data: existing, error: readError } = await supabaseClient
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    currentProfile = existing;
    return existing;
  }

  const profile = {
    id: user.id,
    name: user.user_metadata?.name || user.email,
    role: user.user_metadata?.role || "student"
  };

  const { data, error } = await supabaseClient
    .from("profiles")
    .insert(profile)
    .select("id, name, role")
    .single();

  if (error) throw error;

  currentProfile = data;
  return data;
}

async function loadSession() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error) {
    console.error(error);
    return;
  }

  currentUser = data.user;

  if (currentUser) {
    try {
      await ensureProfile(currentUser);
    } catch (error) {
      console.error("Profile error:", error);
      showNotice("تعذر تحميل ملف الحساب. تحقق من سياسات جدول profiles.");
    }
  }

  updateInterface();
  await loadOpportunities();

  if (currentUser && currentProfile) {
    await loadApplications();
  }
}

function updateInterface() {
  const loggedIn = Boolean(currentUser);

  $("#authForms").hidden = loggedIn;
  $("#logout").hidden = !loggedIn;
  $("#dashboard").hidden = !loggedIn;
  $("#companyArea").hidden =
    !loggedIn || currentProfile?.role !== "company";

  $("#welcome").textContent = loggedIn
    ? `مرحبًا ${currentProfile?.name || currentUser.email} — نوع الحساب: ${roleName(currentProfile?.role)}`
    : "أنشئ حسابًا أو سجّل الدخول للبدء.";
}

function roleName(role) {
  return {
    student: "طالب",
    company: "شركة",
    university: "جامعة / كلية"
  }[role] || "مستخدم";
}

// إنشاء حساب جديد
$("#register").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const values = new FormData(form);

  const name = values.get("name").trim();
  const email = values.get("email").trim();
  const password = values.get("password");
  const role = values.get("role");

  setLoading(form, true);
  showNotice("جارٍ إنشاء الحساب...");

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, role }
      }
    });

    if (error) throw error;

    if (data.session && data.user) {
      currentUser = data.user;
      await ensureProfile(data.user);
      updateInterface();
      showNotice("تم إنشاء الحساب بنجاح.");
      await loadOpportunities();
      await loadApplications();
    } else {
      showNotice(
        "تم إرسال طلب التسجيل. تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول."
      );
    }
  } catch (error) {
    console.error(error);
    showNotice("تعذر إنشاء الحساب: " + error.message);
  } finally {
    setLoading(form, false);
  }
});

// تسجيل الدخول
$("#login").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const values = new FormData(form);

  setLoading(form, true);
  showNotice("جارٍ تسجيل الدخول...");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: values.get("email").trim(),
      password: values.get("password")
    });

    if (error) throw error;

    currentUser = data.user;
    await ensureProfile(data.user);

    updateInterface();
    showNotice("تم تسجيل الدخول بنجاح.");
    await loadOpportunities();
    await loadApplications();
  } catch (error) {
    console.error(error);
    showNotice("تعذر تسجيل الدخول: " + error.message);
  } finally {
    setLoading(form, false);
  }
});

// تسجيل الخروج
$("#logout").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showNotice("تعذر تسجيل الخروج: " + error.message);
    return;
  }

  currentUser = null;
  currentProfile = null;

  updateInterface();
  $("#applications").replaceChildren();
  showNotice("تم تسجيل الخروج.");
  await loadOpportunities();
});

// عرض فرص التدريب
async function loadOpportunities() {
  const list = $("#jobList");
  list.replaceChildren();

  const values = new FormData($("#search"));
  const query = (values.get("q") || "").trim();
  const city = (values.get("city") || "").trim();

  let request = supabaseClient
    .from("opportunities")
    .select("id, company_id, title, description, city, status, created_at")
    .order("created_at", { ascending: false });

  if (query) request = request.ilike("title", `%${query}%`);
  if (city) request = request.ilike("city", `%${city}%`);

  const { data, error } = await request;

  if (error) {
    console.error(error);
    list.textContent = "تعذر تحميل الفرص. تحقق من صلاحيات جدول opportunities.";
    return;
  }

  if (!data.length) {
    list.textContent = "لا توجد فرص مطابقة حاليًا.";
    return;
  }

  for (const job of data) {
    const card = document.createElement("article");
    card.className = "job-card";

    const title = document.createElement("h3");
    title.textContent = job.title;

    const location = document.createElement("p");
    location.textContent = `المدينة: ${job.city || "غير محددة"}`;

    const description = document.createElement("p");
    description.textContent = job.description || "";

    card.append(title, location, description);

    if (
      currentUser &&
      currentProfile?.role === "student"
    ) {
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className = "primary";
      applyButton.textContent = "التقديم على الفرصة";

      applyButton.addEventListener("click", async () => {
        applyButton.disabled = true;

        try {
          const { error } = await supabaseClient
            .from("applications")
            .insert({
              student_id: currentUser.id,
              opportunity_id: job.id,
              status: "pending"
            });

          if (error) throw error;

          showNotice("تم التقديم بنجاح.");
          await loadApplications();
        } catch (error) {
          console.error(error);
          showNotice(
            error.code === "23505"
              ? "سبق لك التقديم على هذه الفرصة."
              : "تعذر التقديم: " + error.message
          );
        } finally {
          applyButton.disabled = false;
        }
      });

      card.append(applyButton);
    } else if (!currentUser) {
      const hint = document.createElement("p");
      hint.textContent = "سجّل الدخول بحساب طالب للتقديم.";
      card.append(hint);
    }

    list.append(card);
  }
}

$("#search").addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadOpportunities();
});

// نشر فرصة تدريب
$("#newJob").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || currentProfile?.role !== "company") {
    showNotice("يجب تسجيل الدخول بحساب شركة لنشر الفرص.");
    return;
  }

  const form = event.currentTarget;
  const values = new FormData(form);

  setLoading(form, true);
  showNotice("جارٍ نشر الفرصة...");

  try {
    const { error } = await supabaseClient
      .from("opportunities")
      .insert({
        company_id: currentUser.id,
        title: values.get("title").trim(),
        description:
          `التخصص: ${values.get("major").trim()}\n` +
          values.get("description").trim(),
        city: values.get("city").trim(),
        status: "published"
      });

    if (error) throw error;

    form.reset();
    showNotice("تم نشر الفرصة بنجاح.");
    await loadOpportunities();
  } catch (error) {
    console.error(error);
    showNotice("تعذر نشر الفرصة: " + error.message);
  } finally {
    setLoading(form, false);
  }
});

// عرض الطلبات الخاصة بالطالب أو الفرص التابعة للشركة
async function loadApplications() {
  const container = $("#applications");
  container.replaceChildren();

  if (!currentUser || !currentProfile) return;

  let request = supabaseClient
    .from("applications")
    .select("id, opportunity_id, student_id, status, created_at")
    .order("created_at", { ascending: false });

  if (currentProfile.role === "student") {
    request = request.eq("student_id", currentUser.id);
  } else if (currentProfile.role !== "company") {
    container.textContent = "لا توجد طلبات لعرضها لهذا النوع من الحسابات.";
    return;
  }

  const { data: applications, error } = await request;

  if (error) {
    console.error(error);
    container.textContent = "تعذر تحميل الطلبات. تحقق من سياسات applications.";
    return;
  }

  if (!applications.length) {
    container.textContent = "لا توجد طلبات حاليًا.";
    return;
  }

  const { data: opportunities, error: opportunitiesError } =
    await supabaseClient
      .from("opportunities")
      .select("id, title, company_id");

  if (opportunitiesError) {
    console.error(opportunitiesError);
    container.textContent = "تعذر تحميل أسماء الفرص.";
    return;
  }

  const opportunityMap = new Map(
    opportunities.map((item) => [item.id, item])
  );

  for (const application of applications) {
    const opportunity = opportunityMap.get(application.opportunity_id);

    // إظهار طلبات الفرص التابعة للشركة الحالية فقط
    if (
      currentProfile.role === "company" &&
      opportunity?.company_id !== currentUser.id
    ) {
      continue;
    }

    const item = document.createElement("article");
    item.className = "application-card";

    const title = document.createElement("p");
    title.textContent = `الفرصة: ${opportunity?.title || "فرصة تدريب"}`;

    const status = document.createElement("p");
    status.textContent = `حالة الطلب: ${statusName(application.status)}`;

    item.append(title, status);

    if (currentProfile.role === "company") {
      const select = document.createElement("select");

      for (const [value, label] of [
        ["pending", "قيد المراجعة"],
        ["accepted", "مقبول"],
        ["rejected", "مرفوض"]
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
      }

      select.value = application.status;

      const updateButton = document.createElement("button");
      updateButton.type = "button";
      updateButton.className = "primary";
      updateButton.textContent = "تحديث الحالة";

      updateButton.addEventListener("click", async () => {
        updateButton.disabled = true;

        try {
          const { error } = await supabaseClient
            .from("applications")
            .update({ status: select.value })
            .eq("id", application.id);

          if (error) throw error;

          showNotice("تم تحديث حالة الطلب.");
          await loadApplications();
        } catch (error) {
          console.error(error);
          showNotice("تعذر تحديث الطلب: " + error.message);
        } finally {
          updateButton.disabled = false;
        }
      });

      item.append(select, updateButton);
    }

    container.append(item);
  }
}

function statusName(status) {
  return {
    pending: "قيد المراجعة",
    accepted: "مقبول",
    rejected: "مرفوض"
  }[status] || status || "غير محدد";
}

// متابعة حالة تسجيل الدخول
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentUser = null;
    currentProfile = null;
    updateInterface();
  }
});

// تشغيل الموقع
loadSession();
