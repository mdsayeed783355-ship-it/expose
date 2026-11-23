
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
  { name: "ব্যবসার আয়", type: "income" },
  { name: "অন্যান্য আয়", type: "income" },
  { name: "খাবার", type: "expense" },
  { name: "বাজার", type: "expense" },
  { name: "বাসা ভাড়া", type: "expense" },
  { name: "যাতায়াত", type: "expense" },
  { name: "চিকিৎসা", type: "expense" },
  { name: "শিক্ষা", type: "expense" },
  { name: "অন্যান্য", type: "expense" },
];

const money = (amount) =>
  Number(amount || 0).toLocaleString("bn-BD", {
    maximumFractionDigits: 2,
  });

const today = () => {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 10);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [debts, setDebts] = useState([]);

  const [month, setMonth] = useState(today().slice(0, 7));
  const [activeTab, setActiveTab] = useState("dashboard");

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

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadTransactions();
      loadCategories();
      loadDebts();
    } else {
      setTransactions([]);
      setCategories([]);
      setDebts([]);
    }
  }, [user]);

  useEffect(() => {
    const available = categories.filter(
      (item) => item.type === form.type
    );

    if (available.length > 0) {
      setForm((old) => ({
        ...old,
        category: available.some((item) => item.name === old.category)
          ? old.category
          : available[0].name,
      }));
    } else {
      setForm((old) => ({ ...old, category: "" }));
    }
  }, [form.type, categories]);

  async function checkUser() {
    const { data } = await supabase.auth.getSession();
    setUser(data.session?.user || null);
    setLoading(false);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setMessage("লগইন হচ্ছে...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("লগইন সমস্যা: " + error.message);
    } else {
      setMessage("লগইন সফল হয়েছে।");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setTransactions([]);
    setCategories([]);
    setDebts([]);
    setMessage("");
  }

  async function loadTransactions() {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });

    if (error) {
      setMessage("হিসাব লোড সমস্যা: " + error.message);
      return;
    }

    setTransactions(data || []);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      setMessage("ক্যাটাগরি লোড সমস্যা: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      const initial = defaultCategories.map((item) => ({
        ...item,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase
        .from("categories")
        .upsert(initial, {
          onConflict: "user_id,name,type",
          ignoreDuplicates: true,
        });

      if (insertError) {
        setMessage("ডিফল্ট ক্যাটাগরি তৈরি হয়নি: " + insertError.message);
        return;
      }

      const { data: newData, error: reloadError } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (reloadError) {
        setMessage("ক্যাটাগরি লোড সমস্যা: " + reloadError.message);
        return;
      }

      setCategories(newData || []);
      return;
    }

    setCategories(data);
  }

  async function loadDebts() {
    const { data, error } = await supabase
      .from("debts")
      .select("*")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });

    if (error) {
      setMessage("ধার-দেনার হিসাব লোড সমস্যা: " + error.message);
      return;
    }

    setDebts(data || []);
  }

  async function addTransaction(e) {
    e.preventDefault();

    if (!form.category || !form.amount || Number(form.amount) <= 0) {
      setMessage("সঠিক ক্যাটাগরি ও টাকার পরিমাণ দিন।");
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      description: form.description,
      transaction_date: form.transaction_date,
    });

    if (error) {
      setMessage("হিসাব যোগ হয়নি: " + error.message);
      return;
    }

    setForm((old) => ({
      ...old,
      amount: "",
      description: "",
      transaction_date: today(),
    }));

    setMessage("নতুন হিসাব সফলভাবে যোগ হয়েছে।");
    loadTransactions();
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
      return;
    }

    setMessage("হিসাব মুছে ফেলা হয়েছে।");
    loadTransactions();
  }

  async function addCategory(e) {
    e.preventDefault();

    if (!categoryForm.name.trim()) {
      setMessage("ক্যাটাগরির নাম লিখুন।");
      return;
    }

    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: categoryForm.name.trim(),
      type: categoryForm.type,
    });

    if (error) {
      setMessage("ক্যাটাগরি যোগ হয়নি: " + error.message);
      return;
    }

    setCategoryForm({ name: "", type: "expense" });
    setMessage("নতুন ক্যাটাগরি যোগ হয়েছে।");
    loadCategories();
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
      return;
    }

    setMessage("ক্যাটাগরি মুছে ফেলা হয়েছে।");
    loadCategories();
  }

  async function addDebt(e) {
    e.preventDefault();

    if (!debtForm.person_name.trim()) {
      setMessage("ব্যক্তির নাম লিখুন।");
      return;
    }

    const amount = Number(debtForm.amount);
    const paid = Number(debtForm.paid_amount || 0);

    if (!amount || amount <= 0 || paid < 0 || paid > amount) {
      setMessage(
        "টাকার পরিমাণ সঠিকভাবে দিন। পরিশোধিত টাকা মোট টাকার বেশি হতে পারবে না।"
      );
      return;
    }

    const { error } = await supabase.from("debts").insert({
      user_id: user.id,
      person_name: debtForm.person_name.trim(),
      type: debtForm.type,
      amount,
      paid_amount: paid,
      note: debtForm.note,
      transaction_date: debtForm.transaction_date,
    });

    if (error) {
      setMessage("ধার-দেনার হিসাব যোগ হয়নি: " + error.message);
      return;
    }

    setDebtForm({
      person_name: "",
      type: "lent",
      amount: "",
      paid_amount: "0",
      note: "",
      transaction_date: today(),
    });

    setMessage("ধার-দেনার হিসাব সফলভাবে যোগ হয়েছে।");
    loadDebts();
  }

  async function updateDebtPayment(debt) {
    const remaining =
      Number(debt.amount) - Number(debt.paid_amount);

    if (remaining <= 0) {
      setMessage("এই টাকার সম্পূর্ণ পরিশোধ হয়েছে।");
      return;
    }

    const answer = window.prompt(
      `বর্তমানে পরিশোধ হয়েছে ${money(debt.paid_amount)} টাকা।\nনতুন মোট পরিশোধিত টাকার পরিমাণ লিখুন:`,
      String(debt.paid_amount)
    );

    if (answer === null) return;

    const paid = Number(answer);

    if (
      answer.trim() === "" ||
      !Number.isFinite(paid) ||
      paid < 0 ||
      paid > Number(debt.amount)
    ) {
      setMessage("সঠিক পরিশোধিত টাকার পরিমাণ দিন।");
      return;
    }

    const { error } = await supabase
      .from("debts")
      .update({ paid_amount: paid })
      .eq("id", debt.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage("পরিশোধের হিসাব আপডেট হয়নি: " + error.message);
      return;
    }

    setMessage("পরিশোধের হিসাব আপডেট হয়েছে।");
    loadDebts();
  }

  async function deleteDebt(id) {
    if (!window.confirm("এই ধার-দেনার হিসাবটি মুছে ফেলতে চান?")) return;

    const { error } = await supabase
      .from("debts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setMessage("হিসাব মুছতে সমস্যা: " + error.message);
      return;
    }

    setMessage("ধার-দেনার হিসাব মুছে ফেলা হয়েছে।");
    loadDebts();
  }

  const filteredTransactions = transactions.filter(
    (item) => item.transaction_date?.slice(0, 7) === month
  );

  const income = filteredTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expense = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = income - expense;

  const monthlyChart = [
    { name: "আয়", amount: income },
    { name: "ব্যয়", amount: expense },
  ];

  const expenseChart = Object.values(
    filteredTransactions
      .filter((item) => item.type === "expense")
      .reduce((acc, item) => {
        acc[item.category] = acc[item.category] || {
          name: item.category,
          value: 0,
        };
        acc[item.category].value += Number(item.amount);
        return acc;
      }, {})
  );

  const lentDebts = debts.filter((item) => item.type === "lent");
  const borrowedDebts = debts.filter((item) => item.type === "borrowed");

  const totalLent = lentDebts.reduce(
    (sum, item) =>
      sum + Number(item.amount) - Number(item.paid_amount),
    0
  );

  const totalBorrowed = borrowedDebts.reduce(
    (sum, item) =>
      sum + Number(item.amount) - Number(item.paid_amount),
    0
  );

  // মাসিক রিপোর্ট ও PDF প্রিন্ট
  function downloadMonthlyReport() {
    const reportMonth = month;
    const reportTransactions = filteredTransactions;

    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char]
      );

    const transactionRows = reportTransactions
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.transaction_date)}</td>
            <td>${item.type === "income" ? "আয়" : "ব্যয়"}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${money(item.amount)} ৳</td>
            <td>${escapeHtml(item.description || "—")}</td>
          </tr>
        `
      )
      .join("");

    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      setMessage("পপ-আপ বন্ধ আছে। ব্রাউজারে Pop-ups অনুমতি দিন।");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Expose মাসিক রিপোর্ট</title>

        <style>
          @font-face {
            font-family: NotoBengali;
            src: url("/fonts/NotoSansBengali-Regular.ttf") format("truetype");
          }

          body {
            font-family: NotoBengali, sans-serif;
            padding: 25px;
            color: #1e293b;
          }

          h1, h2, p {
            text-align: center;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin: 25px 0;
          }

          .summary div {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: center;
            border-radius: 8px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }

          th, td {
            border: 1px solid #ccc;
            padding: 9px;
            text-align: left;
          }

          th {
            background: #e5e7eb;
          }

          .print-button {
            display: block;
            margin: 20px auto;
            padding: 12px 25px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            font-family: NotoBengali, sans-serif;
          }

          @media print {
            .print-button {
              display: none;
            }

            body {
              padding: 0;
            }
          }
        </style>
      </head>

      <body>
        <h1>Expose</h1>
        <h2>মাসিক আয়-ব্যয়ের রিপোর্ট</h2>
        <p>রিপোর্টের মাস: ${escapeHtml(reportMonth)}</p>

        <div class="summary">
          <div>
            <strong>মোট আয়</strong>
            <h3>${money(income)} ৳</h3>
          </div>

          <div>
            <strong>মোট ব্যয়</strong>
            <h3>${money(expense)} ৳</h3>
          </div>

          <div>
            <strong>উদ্বৃত্ত</strong>
            <h3>${money(balance)} ৳</h3>
          </div>

          <div>
            <strong>আপনার পাওনা</strong>
            <h3>${money(totalLent)} ৳</h3>
          </div>

          <div>
            <strong>আপনার দেনা</strong>
            <h3>${money(totalBorrowed)} ৳</h3>
          </div>
        </div>

        <h3>সকল লেনদেনের বিবরণ</h3>

        <table>
          <thead>
            <tr>
              <th>তারিখ</th>
              <th>ধরন</th>
              <th>ক্যাটাগরি</th>
              <th>টাকা</th>
              <th>বিবরণ</th>
            </tr>
          </thead>

          <tbody>
            ${
              transactionRows ||
              '<tr><td colspan="5">এই মাসে কোনো হিসাব নেই।</td></tr>'
            }
          </tbody>
        </table>

        <button class="print-button" id="printButton">
          PDF হিসেবে সংরক্ষণ করুন
        </button>

        <p>Expose — আপনার সকল হিসাবের সহজ সমাধান</p>
      </body>
      </html>
    `);

    reportWindow.document.close();

    reportWindow.document
      .getElementById("printButton")
      .addEventListener("click", () => reportWindow.print());

    reportWindow.document.fonts.ready.then(() => {
      reportWindow.focus();
      reportWindow.print();
    });
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f3f6fb",
      padding: "20px",
      color: "#1e293b",
      fontFamily: "Arial, sans-serif",
    },
    container: {
      maxWidth: "1150px",
      margin: "auto",
    },
    card: {
      background: "#fff",
      padding: "20px",
      borderRadius: "12px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      marginBottom: "18px",
    },
    input: {
      width: "100%",
      padding: "11px",
      border: "1px solid #d1d5db",
      borderRadius: "7px",
      marginTop: "6px",
      boxSizing: "border-box",
      fontSize: "15px",
    },
    button: {
      padding: "11px 16px",
      border: "none",
      borderRadius: "7px",
      background: "#2563eb",
      color: "white",
      cursor: "pointer",
      fontSize: "14px",
    },
    label: {
      display: "block",
      fontWeight: "600",
      marginTop: "12px",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
      gap: "15px",
    },
    tableWrap: {
      overflowX: "auto",
      width: "100%",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: "600px",
    },
    cell: {
      padding: "12px 9px",
      borderBottom: "1px solid #e5e7eb",
      textAlign: "left",
      whiteSpace: "nowrap",
    },
  };

  if (loading) {
    return <div style={styles.page}>লোড হচ্ছে...</div>;
  }

  if (!user) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: "420px", margin: "70px auto" }}>
          <h1 style={{ textAlign: "center", color: "#2563eb" }}>Expose</h1>
          <h3 style={{ textAlign: "center" }}>
            আপনার অ্যাকাউন্টে লগইন করুন
          </h3>

          <form onSubmit={handleAuth}>
            <label style={styles.label}>ইমেইল</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="আপনার ইমেইল"
              required
            />

            <label style={styles.label}>পাসওয়ার্ড</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="আপনার পাসওয়ার্ড"
              required
            />

            <button
              style={{
                ...styles.button,
                width: "100%",
                marginTop: "18px",
              }}
            >
              লগইন
            </button>
          </form>

          {message && <p>{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header
          style={{
            ...styles.card,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <h1 style={{ color: "#2563eb", margin: 0 }}>Expose</h1>
            <small>আপনার সকল হিসাব এক জায়গায়</small>
          </div>

          <button
            style={{ ...styles.button, background: "#dc2626" }}
            onClick={handleLogout}
          >
            লগআউট
          </button>
        </header>

        <nav
          style={{
            ...styles.card,
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {[
            ["dashboard", "ড্যাশবোর্ড"],
            ["transactions", "আয়-ব্যয়"],
            ["debts", "ধার-দেনা"],
            ["categories", "ক্যাটাগরি"],
            ["monthlyReport", "মাসিক রিপোর্ট"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                ...styles.button,
                background:
                  activeTab === key ? "#1d4ed8" : "#64748b",
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {message && (
          <div
            style={{
              ...styles.card,
              padding: "12px 16px",
              color: "#1d4ed8",
            }}
          >
            {message}
            <button
              onClick={() => setMessage("")}
              style={{
                float: "right",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {activeTab === "dashboard" && (
          <>
            <div style={styles.card}>
              <h2>ড্যাশবোর্ড</h2>
              <label style={styles.label}>মাস নির্বাচন করুন</label>
              <input
                style={{ ...styles.input, maxWidth: "250px" }}
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div style={styles.grid}>
              <div
                style={{
                  ...styles.card,
                  borderLeft: "5px solid #16a34a",
                }}
              >
                <p>মোট আয়</p>
                <h2 style={{ color: "#16a34a" }}>
                  {money(income)} ৳
                </h2>
              </div>

              <div
                style={{
                  ...styles.card,
                  borderLeft: "5px solid #dc2626",
                }}
              >
                <p>মোট ব্যয়</p>
                <h2 style={{ color: "#dc2626" }}>
                  {money(expense)} ৳
                </h2>
              </div>

              <div
                style={{
                  ...styles.card,
                  borderLeft: "5px solid #2563eb",
                }}
              >
                <p>বর্তমান উদ্বৃত্ত</p>
                <h2 style={{ color: "#2563eb" }}>
                  {money(balance)} ৳
                </h2>
              </div>
            </div>

            <div style={styles.grid}>
              <div style={styles.card}>
                <h3>মাসিক আয় ও ব্যয়ের চার্ট</h3>
                <div style={{ width: "100%", height: "270px" }}>
                  <ResponsiveContainer>
                    <BarChart data={monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="amount"
                        name="টাকা"
                        fill="#2563eb"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={styles.card}>
                <h3>ব্যয়ের ক্যাটাগরি অনুযায়ী</h3>
                <div style={{ width: "100%", height: "270px" }}>
                  {expenseChart.length > 0 ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={expenseChart}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={90}
                          label
                        >
                          {expenseChart.map((item, index) => (
                            <Cell
                              key={item.name}
                              fill={[
                                "#2563eb",
                                "#16a34a",
                                "#f59e0b",
                                "#dc2626",
                                "#9333ea",
                                "#0891b2",
                              ][index % 6]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p>এই মাসে কোনো ব্যয়ের হিসাব নেই।</p>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3>সাম্প্রতিক হিসাব</h3>
              <TransactionTable
                items={filteredTransactions.slice(0, 8)}
                styles={styles}
                onDelete={deleteTransaction}
              />
            </div>
          </>
        )}

        {activeTab === "transactions" && (
          <>
            <div style={styles.card}>
              <h2>নতুন আয় / ব্যয় যোগ করুন</h2>

              <form onSubmit={addTransaction}>
                <div style={styles.grid}>
                  <div>
                    <label style={styles.label}>হিসাবের ধরন</label>
                    <select
                      style={styles.input}
                      value={form.type}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value })
                      }
                    >
                      <option value="income">আয়</option>
                      <option value="expense">ব্যয়</option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>ক্যাটাগরি</label>
                    <select
                      style={styles.input}
                      value={form.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category: e.target.value,
                        })
                      }
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
                  </div>

                  <div>
                    <label style={styles.label}>টাকার পরিমাণ</label>
                    <input
                      style={styles.input}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label style={styles.label}>তারিখ</label>
                    <input
                      style={styles.input}
                      type="date"
                      value={form.transaction_date}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          transaction_date: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <label style={styles.label}>বিবরণ</label>
                <input
                  style={styles.input}
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  placeholder="বিস্তারিত লিখুন"
                />

                <button
                  style={{ ...styles.button, marginTop: "16px" }}
                >
                  হিসাব যোগ করুন
                </button>
              </form>
            </div>

            <div style={styles.card}>
              <h2>সকল আয়-ব্যয়ের হিসাব</h2>
              <label style={styles.label}>মাস নির্বাচন করুন</label>
              <input
                style={{ ...styles.input, maxWidth: "250px" }}
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />

              <TransactionTable
                items={filteredTransactions}
                styles={styles}
                onDelete={deleteTransaction}
              />
            </div>
          </>
        )}

        {activeTab === "debts" && (
          <>
            <h2>ধার-দেনা ব্যবস্থাপনা</h2>

            <div style={styles.grid}>
              <div
                style={{
                  ...styles.card,
                  borderLeft: "5px solid #2563eb",
                }}
              >
                <p>অন্যের কাছে আপনার পাওনা</p>
                <h2 style={{ color: "#2563eb" }}>
                  {money(totalLent)} ৳
                </h2>
              </div>

              <div
                style={{
                  ...styles.card,
                  borderLeft: "5px solid #dc2626",
                }}
              >
                <p>অন্যের কাছে আপনার দেনা</p>
                <h2 style={{ color: "#dc2626" }}>
                  {money(totalBorrowed)} ৳
                </h2>
              </div>
            </div>

            <div style={styles.card}>
              <h3>নতুন ধার-দেনার হিসাব যোগ করুন</h3>

              <form onSubmit={addDebt}>
                <div style={styles.grid}>
                  <div>
                    <label style={styles.label}>হিসাবের ধরন</label>
                    <select
                      style={styles.input}
                      value={debtForm.type}
                      onChange={(e) =>
                        setDebtForm({
                          ...debtForm,
                          type: e.target.value,
                        })
                      }
                    >
                      <option value="lent">
                        আমি টাকা ধার দিয়েছি
                      </option>
                      <option value="borrowed">
                        আমি টাকা ধার নিয়েছি
                      </option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>ব্যক্তির নাম</label>
                    <input
                      style={styles.input}
                      value={debtForm.person_name}
                      onChange={(e) =>
                        setDebtForm({
                          ...debtForm,
                          person_name: e.target.value,
                        })
                      }
                      placeholder="ব্যক্তির নাম লিখুন"
                      required
                    />
                  </div>

                  <div>
                    <label style={styles.label}>মোট টাকা</label>
                    <input
                      style={styles.input}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={debtForm.amount}
                      onChange={(e) =>
                        setDebtForm({
                          ...debtForm,
                          amount: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label style={styles.label}>
                      ইতিমধ্যে পরিশোধিত টাকা
                    </label>
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={debtForm.paid_amount}
                      onChange={(e) =>
                        setDebtForm({
                          ...debtForm,
                          paid_amount: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label style={styles.label}>তারিখ</label>
                    <input
                      style={styles.input}
                      type="date"
                      value={debtForm.transaction_date}
                      onChange={(e) =>
                        setDebtForm({
                          ...debtForm,
                          transaction_date: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <label style={styles.label}>বিবরণ</label>
                <input
                  style={styles.input}
                  value={debtForm.note}
                  onChange={(e) =>
                    setDebtForm({
                      ...debtForm,
                      note: e.target.value,
                    })
                  }
                  placeholder="প্রয়োজনীয় তথ্য লিখুন"
                />

                <button
                  style={{ ...styles.button, marginTop: "16px" }}
                >
                  ধার-দেনার হিসাব যোগ করুন
                </button>
              </form>
            </div>

            <div style={styles.card}>
              <h3>ধার দেওয়া টাকার হিসাব</h3>
              <DebtTable
                items={lentDebts}
                styles={styles}
                onUpdate={updateDebtPayment}
                onDelete={deleteDebt}
              />
            </div>

            <div style={styles.card}>
              <h3>ধার নেওয়া টাকার হিসাব</h3>
              <DebtTable
                items={borrowedDebts}
                styles={styles}
                onUpdate={updateDebtPayment}
                onDelete={deleteDebt}
              />
            </div>
          </>
        )}

        {activeTab === "categories" && (
          <>
            <div style={styles.card}>
              <h2>নতুন ক্যাটাগরি যোগ করুন</h2>

              <form onSubmit={addCategory}>
                <div style={styles.grid}>
                  <div>
                    <label style={styles.label}>
                      ক্যাটাগরির নাম
                    </label>
                    <input
                      style={styles.input}
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="যেমন: মোবাইল বিল"
                      required
                    />
                  </div>

                  <div>
                    <label style={styles.label}>
                      ক্যাটাগরির ধরন
                    </label>
                    <select
                      style={styles.input}
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
                  </div>
                </div>

                <button
                  style={{ ...styles.button, marginTop: "16px" }}
                >
                  ক্যাটাগরি যোগ করুন
                </button>
              </form>
            </div>

            <div style={styles.grid}>
              {["income", "expense"].map((type) => (
                <div style={styles.card} key={type}>
                  <h3>
                    {type === "income"
                      ? "আয়ের ক্যাটাগরি"
                      : "ব্যয়ের ক্যাটাগরি"}
                  </h3>

                  {categories
                    .filter((item) => item.type === type)
                    .map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 0",
                          borderBottom: "1px solid #eee",
                          gap: "10px",
                        }}
                      >
                        <span>{item.name}</span>

                        <button
                          style={{
                            ...styles.button,
                            background: "#dc2626",
                            padding: "7px 10px",
                          }}
                          onClick={() => deleteCategory(item.id)}
                        >
                          মুছুন
                        </button>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "monthlyReport" && (
          <>
            <div style={styles.card}>
              <h2>মাসিক রিপোর্ট</h2>

              <label style={styles.label}>
                রিপোর্টের মাস নির্বাচন করুন
              </label>

              <input
                style={{ ...styles.input, maxWidth: "250px" }}
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />

              <div style={{ ...styles.grid, marginTop: "20px" }}>
                <div
                  style={{
                    ...styles.card,
                    borderLeft: "5px solid #16a34a",
                  }}
                >
                  <p>মোট আয়</p>
                  <h2 style={{ color: "#16a34a" }}>
                    {money(income)} ৳
                  </h2>
                </div>

                <div
                  style={{
                    ...styles.card,
                    borderLeft: "5px solid #dc2626",
                  }}
                >
                  <p>মোট ব্যয়</p>
                  <h2 style={{ color: "#dc2626" }}>
                    {money(expense)} ৳
                  </h2>
                </div>

                <div
                  style={{
                    ...styles.card,
                    borderLeft: "5px solid #2563eb",
                  }}
                >
                  <p>মোট উদ্বৃত্ত</p>
                  <h2 style={{ color: "#2563eb" }}>
                    {money(balance)} ৳
                  </h2>
                </div>
              </div>

              <div style={styles.grid}>
                <div style={styles.card}>
                  <p>অন্যের কাছে আপনার পাওনা</p>
                  <h3 style={{ color: "#2563eb" }}>
                    {money(totalLent)} ৳
                  </h3>
                </div>

                <div style={styles.card}>
                  <p>অন্যের কাছে আপনার দেনা</p>
                  <h3 style={{ color: "#dc2626" }}>
                    {money(totalBorrowed)} ৳
                  </h3>
                </div>
              </div>

              <button
                style={{
                  ...styles.button,
                  background: "#16a34a",
                  marginTop: "10px",
                }}
                onClick={downloadMonthlyReport}
              >
                PDF ডাউনলোড / সংরক্ষণ করুন
              </button>
            </div>

            <div style={styles.card}>
              <h3>নির্বাচিত মাসের সকল হিসাব</h3>

              <TransactionTable
                items={filteredTransactions}
                styles={styles}
                onDelete={deleteTransaction}
              />
            </div>
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            padding: "20px",
            color: "#64748b",
          }}
        >
          Expose — আপনার সকল হিসাবের সহজ সমাধান
        </footer>
      </div>
    </div>
  );
}

function TransactionTable({ items, styles, onDelete }) {
  if (!items.length) {
    return <p>কোনো হিসাব পাওয়া যায়নি।</p>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {[
              "তারিখ",
              "ধরন",
              "ক্যাটাগরি",
              "টাকা",
              "বিবরণ",
              "অ্যাকশন",
            ].map((heading) => (
              <th key={heading} style={styles.cell}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={styles.cell}>{item.transaction_date}</td>
              <td style={styles.cell}>
                {item.type === "income" ? "আয়" : "ব্যয়"}
              </td>
              <td style={styles.cell}>{item.category}</td>
              <td style={styles.cell}>{money(item.amount)} ৳</td>
              <td style={styles.cell}>
                {item.description || "—"}
              </td>
              <td style={styles.cell}>
                <button
                  style={{
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    padding: "7px 10px",
                    cursor: "pointer",
                  }}
                  onClick={() => onDelete(item.id)}
                >
                  মুছুন
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DebtTable({ items, styles, onUpdate, onDelete }) {
  if (!items.length) {
    return <p>এখনো কোনো হিসাব যোগ করা হয়নি।</p>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {[
              "তারিখ",
              "ব্যক্তির নাম",
              "মোট টাকা",
              "পরিশোধিত",
              "বাকি",
              "বিবরণ",
              "অ্যাকশন",
            ].map((heading) => (
              <th key={heading} style={styles.cell}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const remaining =
              Number(item.amount) - Number(item.paid_amount);

            return (
              <tr key={item.id}>
                <td style={styles.cell}>
                  {item.transaction_date}
                </td>

                <td style={styles.cell}>{item.person_name}</td>

                <td style={styles.cell}>
                  {money(item.amount)} ৳
                </td>

                <td style={styles.cell}>
                  {money(item.paid_amount)} ৳
                </td>

                <td style={styles.cell}>
                  <strong
                    style={{
                      color:
                        remaining > 0 ? "#dc2626" : "#16a34a",
                    }}
                  >
                    {money(remaining)} ৳
                  </strong>
                </td>

                <td style={styles.cell}>{item.note || "—"}</td>

                <td style={styles.cell}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button
                      style={{
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        padding: "7px 9px",
                        cursor: "pointer",
                      }}
                      onClick={() => onUpdate(item)}
                    >
                      পরিশোধ আপডেট
                    </button>

                    <button
                      style={{
                        background: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        padding: "7px 9px",
                        cursor: "pointer",
                      }}
                      onClick={() => onDelete(item.id)}
                    >
                      মুছুন
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
