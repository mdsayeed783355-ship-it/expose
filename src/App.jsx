
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./index.css";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const defaultCategories = [
  { name: "বেতন", type: "income" },
  { name: "ব্যবসা", type: "income" },
  { name: "অন্যান্য আয়", type: "income" },
  { name: "খাবার", type: "expense" },
  { name: "বাসা ভাড়া", type: "expense" },
  { name: "যাতায়াত", type: "expense" },
  { name: "চিকিৎসা", type: "expense" },
  { name: "শিক্ষা", type: "expense" },
  { name: "অন্যান্য খরচ", type: "expense" },
];

const money = (value) =>
  Number(value || 0).toLocaleString("bn-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const today = () => new Date().toISOString().slice(0, 10);

const currentMonth = () => today().slice(0, 7);

const COLORS = [
  "#176b50",
  "#2877c7",
  "#e69b28",
  "#dc5555",
  "#7952b3",
  "#159eaa",
  "#8b9a35",
];

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [debts, setDebts] = useState([]);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [month, setMonth] = useState(currentMonth());

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    type: "income",
    category: "",
    amount: "",
    description: "",
    transaction_date: today(),
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    type: "expense",
  });

  const [debtForm, setDebtForm] = useState({
    person_name: "",
    type: "lent",
    amount: "",
    paid_amount: "0",
    note: "",
    transaction_date: today(),
  });

  // Login session পরীক্ষা
  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setMessage("লগইন পরীক্ষা করা যায়নি: " + error.message);
      }

      setUser(data?.session?.user || null);
      setLoading(false);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user || null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ব্যবহারকারী লগইন করলে তার হিসাব লোড
  useEffect(() => {
    if (user) {
      loadAllData();
    } else {
      setTransactions([]);
      setCategories([]);
      setDebts([]);
    }
  }, [user]);

  async function loadAllData() {
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      const [transactionResult, categoryResult, debtResult] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase
            .from("categories")
            .select("*")
            .eq("user_id", user.id)
            .order("name"),

          supabase
            .from("debts")
            .select("*")
            .eq("user_id", user.id)
            .order("transaction_date", { ascending: false }),
        ]);

      if (transactionResult.error) throw transactionResult.error;
      if (categoryResult.error) throw categoryResult.error;
      if (debtResult.error) throw debtResult.error;

      let categoryData = categoryResult.data || [];

      // প্রথমবার ব্যবহার করলে প্রাথমিক ক্যাটাগরি তৈরি
      if (categoryData.length === 0) {
        const defaults = defaultCategories.map((item) => ({
          ...item,
          user_id: user.id,
        }));

        const { data, error } = await supabase
          .from("categories")
          .upsert(defaults, {
            onConflict: "user_id,name,type",
          })
          .select();

        if (error) throw error;

        categoryData = data || [];
      }

      setTransactions(transactionResult.data || []);
      setCategories(categoryData);
      setDebts(debtResult.data || []);
    } catch (error) {
      setMessage("তথ্য লোড করতে সমস্যা: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Registration ও Login
  async function handleAuth(e) {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("ইমেইল ও পাসওয়ার্ড লিখুন।");
      return;
    }

    if (password.length < 6) {
      setMessage("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }

    setSaving(true);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("অ্যাকাউন্ট তৈরি হয়েছে।");
        } else {
          setMessage(
            "অ্যাকাউন্ট তৈরি হয়েছে। আপনার ইমেইলে পাঠানো Verification Link-এ ক্লিক করে অ্যাকাউন্ট চালু করুন।"
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage("লগইন সফল হয়েছে।");
      }
    } catch (error) {
      setMessage("সমস্যা: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage("লগআউট সমস্যা: " + error.message);
    } else {
      setMessage("আপনি লগআউট করেছেন।");
      setAuthMode("login");
    }
  }

  // Transaction form পরিবর্তন
  function handleFormChange(e) {
    const { name, value } = e.target;

    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  }

  // নতুন আয় বা ব্যয় যোগ এবং পুরোনো হিসাব Edit
  async function saveTransaction(e) {
    e.preventDefault();

    if (!user) return;

    if (!form.category || Number(form.amount) <= 0) {
      setMessage("ক্যাটাগরি নির্বাচন করুন এবং সঠিক টাকার পরিমাণ লিখুন।");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      user_id: user.id,
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      description: form.description.trim(),
      transaction_date: form.transaction_date,
    };

    try {
      let result;

      if (editingId) {
        result = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", user.id);
      } else {
        result = await supabase
          .from("transactions")
          .insert([payload]);
      }

      if (result.error) throw result.error;

      setMessage(editingId ? "হিসাব পরিবর্তন হয়েছে।" : "হিসাব সংরক্ষণ হয়েছে।");
      resetTransactionForm();
      await loadAllData();
    } catch (error) {
      setMessage("হিসাব সংরক্ষণে সমস্যা: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  function resetTransactionForm() {
    setEditingId(null);

    setForm({
      type: "income",
      category: "",
      amount: "",
      description: "",
      transaction_date: today(),
    });
  }

  function editTransaction(item) {
    setEditingId(item.id);

    setForm({
      type: item.type,
      category: item.category,
      amount: String(item.amount),
      description: item.description || "",
      transaction_date: item.transaction_date,
    });

    setActiveTab("transactions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTransaction(id) {
    if (!window.confirm("এই হিসাবটি মুছে ফেলতে চান?")) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setMessage("মুছতে সমস্যা: " + error.message);
    } else {
      setMessage("হিসাব মুছে ফেলা হয়েছে।");
      await loadAllData();
    }
  }

  // নতুন ক্যাটাগরি
  async function addCategory(e) {
    e.preventDefault();

    if (!categoryForm.name.trim()) {
      setMessage("ক্যাটাগরির নাম লিখুন।");
      return;
    }

    const { error } = await supabase.from("categories").insert([
      {
        user_id: user.id,
        name: categoryForm.name.trim(),
        type: categoryForm.type,
      },
    ]);

    if (error) {
      setMessage("ক্যাটাগরি যোগ করতে সমস্যা: " + error.message);
    } else {
      setMessage("নতুন ক্যাটাগরি যোগ হয়েছে।");
      setCategoryForm({ name: "", type: "expense" });
      await loadAllData();
    }
  }

  async function deleteCategory(id) {
    if (!window.confirm("এই ক্যাটাগরি মুছে ফেলতে চান?")) return;

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setMessage("ক্যাটাগরি মুছতে সমস্যা: " + error.message);
    } else {
      setMessage("ক্যাটাগরি মুছে ফেলা হয়েছে।");
      await loadAllData();
    }
  }

  // ঋণ বা পাওনা যোগ
  async function addDebt(e) {
    e.preventDefault();

    if (!debtForm.person_name.trim() || Number(debtForm.amount) <= 0) {
      setMessage("ব্যক্তির নাম ও সঠিক টাকার পরিমাণ লিখুন।");
      return;
    }

    if (
      Number(debtForm.paid_amount) < 0 ||
      Number(debtForm.paid_amount) > Number(debtForm.amount)
    ) {
      setMessage("পরিশোধিত টাকা মোট টাকার চেয়ে বেশি হতে পারবে না।");
      return;
    }

    const { error } = await supabase.from("debts").insert([
      {
        user_id: user.id,
        person_name: debtForm.person_name.trim(),
        type: debtForm.type,
        amount: Number(debtForm.amount),
        paid_amount: Number(debtForm.paid_amount || 0),
        note: debtForm.note.trim(),
        transaction_date: debtForm.transaction_date,
      },
    ]);

    if (error) {
      setMessage("ঋণের হিসাব যোগ করতে সমস্যা: " + error.message);
    } else {
      setMessage("ঋণের হিসাব সংরক্ষণ হয়েছে।");
      setDebtForm({
        person_name: "",
        type: "lent",
        amount: "",
        paid_amount: "0",
        note: "",
        transaction_date: today(),
      });
      await loadAllData();
    }
  }

  async function updateDebtPayment(item) {
    const remaining = Number(item.amount) - Number(item.paid_amount || 0);

    const input = window.prompt(
      "আর কত টাকা পরিশোধ হয়েছে? বাকি টাকা: " + money(remaining),
      "0"
    );

    if (input === null) return;

    const additional = Number(input);

    if (
      !Number.isFinite(additional) ||
      additional < 0 ||
      additional > remaining
    ) {
      setMessage("সঠিক পরিশোধের পরিমাণ লিখুন।");
      return;
    }

    const { error } = await supabase
      .from("debts")
      .update({
        paid_amount: Number(item.paid_amount || 0) + additional,
      })
      .eq("id", item.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage("পরিশোধ আপডেট হয়নি: " + error.message);
    } else {
      setMessage("পরিশোধের হিসাব আপডেট হয়েছে।");
      await loadAllData();
    }
  }

  async function deleteDebt(id) {
    if (!window.confirm("এই ঋণের হিসাব মুছে ফেলতে চান?")) return;

    const { error } = await supabase
      .from("debts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setMessage("মুছতে সমস্যা: " + error.message);
    } else {
      setMessage("ঋণের হিসাব মুছে ফেলা হয়েছে।");
      await loadAllData();
    }
  }

  // নির্বাচিত মাসের হিসাব
  const monthlyTransactions = transactions.filter(
    (item) => item.transaction_date?.slice(0, 7) === month
  );

  const income = monthlyTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expense = monthlyTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = income - expense;

  const lentTotal = debts
    .filter((item) => item.type === "lent")
    .reduce(
      (sum, item) =>
        sum + Number(item.amount) - Number(item.paid_amount || 0),
      0
    );

  const borrowedTotal = debts
    .filter((item) => item.type === "borrowed")
    .reduce(
      (sum, item) =>
        sum + Number(item.amount) - Number(item.paid_amount || 0),
      0
    );

  const expenseChartData = Object.values(
    monthlyTransactions
      .filter((item) => item.type === "expense")
      .reduce((result, item) => {
        if (!result[item.category]) {
          result[item.category] = {
            name: item.category,
            value: 0,
          };
        }

        result[item.category].value += Number(item.amount);
        return result;
      }, {})
  );

  const barChartData = [
    { name: "আয়", amount: income },
    { name: "ব্যয়", amount: expense },
  ];

  // মাসিক PDF রিপোর্ট
  function downloadMonthlyReport() {
    const htmlEscape = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]);

    const rows = monthlyTransactions
      .map(
        (item) => `
          <tr>
            <td>${htmlEscape(item.transaction_date)}</td>
            <td>${htmlEscape(item.category)}</td>
            <td>${item.type === "income" ? "আয়" : "ব্যয়"}</td>
            <td>${money(item.amount)}</td>
            <td>${htmlEscape(item.description)}</td>
          </tr>
        `
      )
      .join("");

    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      setMessage("রিপোর্ট খুলতে Popup অনুমতি দিন।");
      return;
    }

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>Expose মাসিক রিপোর্ট</title>
        <style>
          @font-face {
            font-family: Bengali;
            src: url('/fonts/NotoSansBengali-Regular.ttf');
          }
          body {
            font-family: Bengali, sans-serif;
            padding: 25px;
            color: #172033;
          }
          h1, h2 { color: #176b50; }
          .summary {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
          }
          .summary div {
            border: 1px solid #ddd;
            padding: 12px;
            border-radius: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 9px;
            text-align: left;
          }
          th { background: #eaf3ef; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Expose - মাসিক হিসাব রিপোর্ট</h1>
        <h2>মাস: ${htmlEscape(month)}</h2>
        <p>ইমেইল: ${htmlEscape(user.email)}</p>

        <div class="summary">
          <div>মোট আয়: ${money(income)} টাকা</div>
          <div>মোট ব্যয়: ${money(expense)} টাকা</div>
          <div>অবশিষ্ট: ${money(balance)} টাকা</div>
        </div>

        <h2>আয়-ব্যয়ের তালিকা</h2>
        <table>
          <thead>
            <tr>
              <th>তারিখ</th>
              <th>ক্যাটাগরি</th>
              <th>ধরন</th>
              <th>টাকা</th>
              <th>বিবরণ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <h2>ঋণ ও পাওনা</h2>
        <p>অন্যের কাছে পাওনা: ${money(lentTotal)} টাকা</p>
        <p>অন্যের কাছে দেনা: ${money(borrowedTotal)} টাকা</p>

        <button onclick="window.print()">PDF সংরক্ষণ / Print</button>
      </body>
      </html>
    `);

    reportWindow.document.close();
    reportWindow.onload = () => {
      reportWindow.print();
    };
  }

  if (loading) {
    return (
      <div className="loading">
        <h2>Expose লোড হচ্ছে...</h2>
        <p>একটু অপেক্ষা করুন।</p>
      </div>
    );
  }

  // Login ও Registration screen
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="brand">Expose</h1>
          <h2>
            {authMode === "login" ? "আপনার অ্যাকাউন্টে প্রবেশ করুন" : "নতুন অ্যাকাউন্ট তৈরি করুন"}
          </h2>
          <p className="subtitle">আপনার সকল হিসাব থাকুক এক জায়গায়</p>

          <form onSubmit={handleAuth}>
            <label>ইমেইল ঠিকানা</label>
            <input
              type="email"
              placeholder="আপনার ইমেইল লিখুন"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>পাসওয়ার্ড</label>
            <input
              type="password"
              placeholder="কমপক্ষে ৬ অক্ষর"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />

            <button type="submit" disabled={saving}>
              {saving
                ? "অপেক্ষা করুন..."
                : authMode === "login"
                  ? "লগইন"
                  : "অ্যাকাউন্ট তৈরি করুন"}
            </button>
          </form>

          <div className="switch-auth">
            {authMode === "login" ? (
              <>
                নতুন ব্যবহারকারী?
                <button
                  className="text-button"
                  onClick={() => {
                    setAuthMode("signup");
                    setMessage("");
                  }}
                >
                  রেজিস্ট্রেশন করুন
                </button>
              </>
            ) : (
              <>
                আগে থেকেই অ্যাকাউন্ট আছে?
                <button
                  className="text-button"
                  onClick={() => {
                    setAuthMode("login");
                    setMessage("");
                  }}
                >
                  লগইন করুন
                </button>
              </>
            )}
          </div>

          {message && <p className="message">{message}</p>}
        </div>
      </div>
    );
  }

  const tabs = [
    ["dashboard", "ড্যাশবোর্ড"],
    ["transactions", "আয়-ব্যয়"],
    ["debts", "ধার ও পাওনা"],
    ["categories", "ক্যাটাগরি"],
    ["report", "মাসিক রিপোর্ট"],
  ];

  return (
    <div className="page">
      <div className="container">
        <header className="header card">
          <div>
            <h1 className="brand">Expose</h1>
            <p className="subtitle">আপনার ব্যক্তিগত হিসাব ব্যবস্থাপনা</p>
          </div>

          <div>
            <small>{user.email}</small>
            <br />
            <button className="secondary-button" onClick={handleLogout}>
              লগআউট
            </button>
          </div>
        </header>

        <nav
          className="card"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                background: activeTab === key ? "#176b50" : "#64748b",
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {message && (
          <div className="card message">
            {message}
            <button
              className="text-button"
              onClick={() => setMessage("")}
            >
              বন্ধ
            </button>
          </div>
        )}

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <>
            <div className="card">
              <div className="section-header">
                <h2>হিসাবের সারসংক্ষেপ</h2>
                <div>
                  <label>মাস নির্বাচন</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>
              </div>

              <div className="summary-grid">
                <div className="card income-card">
                  <p>মোট আয়</p>
                  <h2>{money(income)} ৳</h2>
                </div>

                <div className="card expense-card">
                  <p>মোট ব্যয়</p>
                  <h2>{money(expense)} ৳</h2>
                </div>

                <div className="card balance-card">
                  <p>অবশিষ্ট টাকা</p>
                  <h2>{money(balance)} ৳</h2>
                </div>
              </div>
            </div>

            <div className="summary-grid">
              <div className="card">
                <h3>অন্যের কাছে পাওনা</h3>
                <h2 className="income">{money(lentTotal)} ৳</h2>
              </div>
              <div className="card">
                <h3>অন্যের কাছে দেনা</h3>
                <h2 className="expense">{money(borrowedTotal)} ৳</h2>
              </div>
            </div>

            <div className="card">
              <h3>মাসিক আয় ও ব্যয়</h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="amount" name="টাকা" fill="#176b50" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3>ব্যয়ের ক্যাটাগরি</h3>
              {expenseChartData.length === 0 ? (
                <p className="empty">এই মাসে কোনো ব্যয়ের হিসাব নেই।</p>
              ) : (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        label
                      >
                        {expenseChartData.map((item, index) => (
                          <Cell
                            key={item.name}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}

        {/* Income and Expense */}
        {activeTab === "transactions" && (
          <div className="card">
            <h2>{editingId ? "হিসাব পরিবর্তন করুন" : "নতুন আয় বা ব্যয় যোগ করুন"}</h2>

            <form className="transaction-form" onSubmit={saveTransaction}>
              <label>হিসাবের ধরন</label>
              <select
                name="type"
                value={form.type}
                onChange={(e) => {
                  setForm({
                    ...form,
                    type: e.target.value,
                    category: "",
                  });
                }}
              >
                <option value="income">আয়</option>
                <option value="expense">ব্যয়</option>
              </select>

              <label>ক্যাটাগরি</label>
              <select
                name="category"
                value={form.category}
                onChange={handleFormChange}
                required
              >
                <option value="">ক্যাটাগরি নির্বাচন করুন</option>
                {categories
                  .filter((item) => item.type === form.type)
                  .map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
              </select>

              <label>টাকার পরিমাণ</label>
              <input
                type="number"
                name="amount"
                placeholder="টাকার পরিমাণ"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleFormChange}
                required
              />

              <label>তারিখ</label>
              <input
                type="date"
                name="transaction_date"
                value={form.transaction_date}
                onChange={handleFormChange}
                required
              />

              <label>বিবরণ</label>
              <input
                name="description"
                placeholder="বিস্তারিত লিখুন (ঐচ্ছিক)"
                value={form.description}
                onChange={handleFormChange}
              />

              <button type="submit" disabled={saving}>
                {saving ? "সংরক্ষণ হচ্ছে..." : editingId ? "পরিবর্তন সংরক্ষণ" : "হিসাব যোগ করুন"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={resetTransactionForm}
                >
                  বাতিল
                </button>
              )}
            </form>

            <h3>হিসাবের তালিকা</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>তারিখ</th>
                    <th>ধরন</th>
                    <th>ক্যাটাগরি</th>
                    <th>টাকা</th>
                    <th>বিবরণ</th>
                    <th>কাজ</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((item) => (
                    <tr key={item.id}>
                      <td>{item.transaction_date}</td>
                      <td>{item.type === "income" ? "আয়" : "ব্যয়"}</td>
                      <td>{item.category}</td>
                      <td className={item.type}>
                        {money(item.amount)} ৳
                      </td>
                      <td>{item.description}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => editTransaction(item)}
                        >
                          Edit
                        </button>
                        {" "}
                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => deleteTransaction(item.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan="6" className="empty">
                        কোনো হিসাব পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Debts */}
        {activeTab === "debts" && (
          <div className="card">
            <h2>ধার ও পাওনার হিসাব</h2>

            <form className="transaction-form" onSubmit={addDebt}>
              <label>ব্যক্তির নাম</label>
              <input
                placeholder="ব্যক্তির নাম"
                value={debtForm.person_name}
                onChange={(e) =>
                  setDebtForm({
                    ...debtForm,
                    person_name: e.target.value,
                  })
                }
                required
              />

              <label>হিসাবের ধরন</label>
              <select
                value={debtForm.type}
                onChange={(e) =>
                  setDebtForm({
                    ...debtForm,
                    type: e.target.value,
                  })
                }
              >
                <option value="lent">আমি টাকা ধার দিয়েছি (পাওনা)</option>
                <option value="borrowed">আমি টাকা ধার নিয়েছি (দেনা)</option>
              </select>

              <label>মোট টাকা</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="মোট টাকা"
                value={debtForm.amount}
                onChange={(e) =>
                  setDebtForm({
                    ...debtForm,
                    amount: e.target.value,
                  })
                }
                required
              />

              <label>ইতোমধ্যে পরিশোধিত টাকা</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="পরিশোধিত টাকা"
                value={debtForm.paid_amount}
                onChange={(e) =>
                  setDebtForm({
                    ...debtForm,
                    paid_amount: e.target.value,
                  })
                }
              />

              <label>তারিখ</label>
              <input
                type="date"
                value={debtForm.transaction_date}
                onChange={(e) =>
                  setDebtForm({
                    ...debtForm,
                    transaction_date: e.target.value,
                  })
                }
              />

              <label>বিবরণ</label>
              <input
                placeholder="বিবরণ (ঐচ্ছিক)"
                value={debtForm.note}
                onChange={(e) =>
                  setDebtForm({
                    ...debtForm,
                    note: e.target.value,
                  })
                }
              />

              <button type="submit">ঋণের হিসাব যোগ করুন</button>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ব্যক্তি</th>
                    <th>ধরন</th>
                    <th>মোট টাকা</th>
                    <th>পরিশোধ</th>
                    <th>বাকি</th>
                    <th>কাজ</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((item) => {
                    const remaining =
                      Number(item.amount) - Number(item.paid_amount || 0);

                    return (
                      <tr key={item.id}>
                        <td>{item.person_name}</td>
                        <td>
                          {item.type === "lent" ? "পাওনা" : "দেনা"}
                        </td>
                        <td>{money(item.amount)} ৳</td>
                        <td>{money(item.paid_amount)} ৳</td>
                        <td>{money(remaining)} ৳</td>
                        <td>
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => updateDebtPayment(item)}
                            >
                              পরিশোধ
                            </button>
                          )}
                          {" "}
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => deleteDebt(item.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {debts.length === 0 && (
                    <tr>
                      <td colSpan="6" className="empty">
                        কোনো ঋণের হিসাব নেই।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Categories */}
        {activeTab === "categories" && (
          <div className="card">
            <h2>নিজস্ব ক্যাটাগরি তৈরি করুন</h2>

            <form className="transaction-form" onSubmit={addCategory}>
              <label>ক্যাটাগরির নাম</label>
              <input
                placeholder="যেমন: ইন্টারনেট বিল"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    name: e.target.value,
                  })
                }
                required
              />

              <label>ক্যাটাগরির ধরন</label>
              <select
                value={categoryForm.type}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    type: e.target.value,
                  })
                }
              >
                <option value="income">আয়</option>
                <option value="expense">ব্যয়</option>
              </select>

              <button type="submit">ক্যাটাগরি যোগ করুন</button>
            </form>

            <h3>আপনার ক্যাটাগরিগুলো</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>নাম</th>
                    <th>ধরন</th>
                    <th>কাজ</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.type === "income" ? "আয়" : "ব্যয়"}</td>
                      <td>
                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => deleteCategory(item.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monthly report */}
        {activeTab === "report" && (
          <div className="card">
            <h2>মাসিক রিপোর্ট</h2>

            <label>রিপোর্টের মাস নির্বাচন করুন</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />

            <div className="summary-grid">
              <div className="card income-card">
                <p>মোট আয়</p>
                <h2>{money(income)} ৳</h2>
              </div>

              <div className="card expense-card">
                <p>মোট ব্যয়</p>
                <h2>{money(expense)} ৳</h2>
              </div>

              <div className="card balance-card">
                <p>অবশিষ্ট</p>
                <h2>{money(balance)} ৳</h2>
              </div>
            </div>

            <p>মোট হিসাব: {monthlyTransactions.length} টি</p>

            <button type="button" onClick={downloadMonthlyReport}>
              PDF রিপোর্ট তৈরি করুন
            </button>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>তারিখ</th>
                    <th>ক্যাটাগরি</th>
                    <th>ধরন</th>
                    <th>টাকা</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTransactions.map((item) => (
                    <tr key={item.id}>
                      <td>{item.transaction_date}</td>
                      <td>{item.category}</td>
                      <td>{item.type === "income" ? "আয়" : "ব্যয়"}</td>
                      <td>{money(item.amount)} ৳</td>
                    </tr>
                  ))}

                  {monthlyTransactions.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty">
                        এই মাসে কোনো হিসাব নেই।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <footer className="footer">
          Expose © {new Date().getFullYear()} | আপনার হিসাব, আপনার নিয়ন্ত্রণ
        </footer>
      </div>
    </div>
  );
}

export default App;
