
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const initialAccount = {
  account_name: "",
  account_type: "cash",
  opening_balance: "0",
};

const initialEntry = {
  entry_type: "income",
  account_id: "",
  from_account_id: "",
  to_account_id: "",
  amount: "",
  category: "",
  description: "",
  transaction_date: new Date().toISOString().slice(0, 10),
};

const types = {
  cash: "নগদ টাকা",
  bank: "ব্যাংক",
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  other: "অন্যান্য",
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [accountForm, setAccountForm] = useState(initialAccount);
  const [entryForm, setEntryForm] = useState(initialEntry);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [accountResult, entryResult] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("account_entries")
        .select("*")
        .order("transaction_date", { ascending: false }),
    ]);

    if (accountResult.error) {
      setMessage("অ্যাকাউন্ট লোড হয়নি: " + accountResult.error.message);
    } else {
      setAccounts(accountResult.data || []);
    }

    if (entryResult.error) {
      setMessage("লেনদেন লোড হয়নি: " + entryResult.error.message);
    } else {
      setEntries(entryResult.data || []);
    }

    setLoading(false);
  }

  function getBalance(account) {
    let balance = Number(account.opening_balance || 0);

    entries.forEach((entry) => {
      const amount = Number(entry.amount || 0);

      if (entry.entry_type === "income" && entry.account_id === account.id) {
        balance += amount;
      }

      if (entry.entry_type === "expense" && entry.account_id === account.id) {
        balance -= amount;
      }

      if (
        entry.entry_type === "transfer" &&
        entry.from_account_id === account.id
      ) {
        balance -= amount;
      }

      if (
        entry.entry_type === "transfer" &&
        entry.to_account_id === account.id
      ) {
        balance += amount;
      }
    });

    return balance;
  }

  const totalBalance = accounts.reduce(
    (total, account) => total + getBalance(account),
    0
  );

  async function addAccount(e) {
    e.preventDefault();
    setMessage("");

    if (!accountForm.account_name.trim()) {
      setMessage("অ্যাকাউন্টের নাম লিখুন।");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("accounts").insert({
      account_name: accountForm.account_name.trim(),
      account_type: accountForm.account_type,
      opening_balance: Number(accountForm.opening_balance || 0),
      currency: "BDT",
      is_active: true,
    });

    setSaving(false);

    if (error) {
      setMessage("অ্যাকাউন্ট তৈরি হয়নি: " + error.message);
      return;
    }

    setAccountForm(initialAccount);
    setMessage("নতুন অ্যাকাউন্ট তৈরি হয়েছে।");
    await loadData();
  }

  async function addEntry(e) {
    e.preventDefault();
    setMessage("");

    const amount = Number(entryForm.amount);

    if (!amount || amount <= 0) {
      setMessage("সঠিক টাকার পরিমাণ লিখুন।");
      return;
    }

    if (entryForm.entry_type === "transfer") {
      if (!entryForm.from_account_id || !entryForm.to_account_id) {
        setMessage("টাকা পাঠানোর ও গ্রহণের অ্যাকাউন্ট নির্বাচন করুন।");
        return;
      }

      if (entryForm.from_account_id === entryForm.to_account_id) {
        setMessage("একই অ্যাকাউন্টে টাকা স্থানান্তর করা যাবে না।");
        return;
      }
    } else if (!entryForm.account_id) {
      setMessage("একটি অ্যাকাউন্ট নির্বাচন করুন।");
      return;
    }

    const payload = {
      entry_type: entryForm.entry_type,
      account_id:
        entryForm.entry_type === "transfer" ? null : entryForm.account_id,
      from_account_id:
        entryForm.entry_type === "transfer"
          ? entryForm.from_account_id
          : null,
      to_account_id:
        entryForm.entry_type === "transfer"
          ? entryForm.to_account_id
          : null,
      amount,
      category: entryForm.category.trim(),
      description: entryForm.description.trim(),
      transaction_date: entryForm.transaction_date,
    };

    setSaving(true);

    const { error } = await supabase
      .from("account_entries")
      .insert(payload);

    setSaving(false);

    if (error) {
      setMessage("লেনদেন যোগ হয়নি: " + error.message);
      return;
    }

    setEntryForm({
      ...initialEntry,
      account_id: accounts[0]?.id || "",
      from_account_id: accounts[0]?.id || "",
      to_account_id: accounts[1]?.id || "",
    });

    setMessage("লেনদেন সফলভাবে যোগ হয়েছে।");
    await loadData();
  }

  async function deleteEntry(id) {
    const confirmed = window.confirm("এই লেনদেনটি মুছে ফেলতে চান?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("account_entries")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage("মুছতে সমস্যা হয়েছে: " + error.message);
      return;
    }

    setMessage("লেনদেন মুছে ফেলা হয়েছে।");
    await loadData();
  }

  const inputStyle = {
    width: "100%",
    padding: "11px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    boxSizing: "border-box",
    fontSize: "15px",
    background: "white",
  };

  const buttonStyle = {
    padding: "11px 18px",
    border: "none",
    borderRadius: "8px",
    background: "#176b45",
    color: "white",
    cursor: "pointer",
    fontSize: "15px",
  };

  const cardStyle = {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "16px",
  };

  if (loading) {
    return <div style={{ padding: 20 }}>অ্যাকাউন্টের তথ্য লোড হচ্ছে...</div>;
  }

  return (
    <div style={{ padding: "12px", maxWidth: "1100px", margin: "auto" }}>
      <h2>🏦 ব্যাংক ও ওয়ালেট</h2>

      {message && (
        <div
          style={{
            ...cardStyle,
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          ...cardStyle,
          background: "#eef6ff",
        }}
      >
        <div>সর্বমোট টাকা</div>
        <h2 style={{ margin: "8px 0", color: "#176b45" }}>
          ৳ {totalBalance.toLocaleString("en-BD", {
            minimumFractionDigits: 2,
          })}
        </h2>
        <div>মোট অ্যাকাউন্ট: {accounts.length} টি</div>
      </div>

      <div style={cardStyle}>
        <h3>নতুন অ্যাকাউন্ট তৈরি করুন</h3>

        <form onSubmit={addAccount}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <input
              style={inputStyle}
              placeholder="অ্যাকাউন্টের নাম"
              value={accountForm.account_name}
              onChange={(e) =>
                setAccountForm({
                  ...accountForm,
                  account_name: e.target.value,
                })
              }
            />

            <select
              style={inputStyle}
              value={accountForm.account_type}
              onChange={(e) =>
                setAccountForm({
                  ...accountForm,
                  account_type: e.target.value,
                })
              }
            >
              {Object.entries(types).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>

            <input
              style={inputStyle}
              type="number"
              step="0.01"
              placeholder="প্রারম্ভিক ব্যালেন্স"
              value={accountForm.opening_balance}
              onChange={(e) =>
                setAccountForm({
                  ...accountForm,
                  opening_balance: e.target.value,
                })
              }
            />
          </div>

          <button style={{ ...buttonStyle, marginTop: 12 }} disabled={saving}>
            {saving ? "অপেক্ষা করুন..." : "অ্যাকাউন্ট তৈরি করুন"}
          </button>
        </form>
      </div>

      <div style={cardStyle}>
        <h3>আমার অ্যাকাউন্টসমূহ</h3>

        {accounts.length === 0 ? (
          <p>এখনো কোনো অ্যাকাউন্ট তৈরি করা হয়নি।</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            {accounts.map((account) => (
              <div
                key={account.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 14,
                  background: "#fafafa",
                }}
              >
                <strong>{account.account_name}</strong>
                <div style={{ color: "#666", marginTop: 5 }}>
                  {types[account.account_type] || "অন্যান্য"}
                </div>
                <h3 style={{ color: "#176b45" }}>
                  ৳ {getBalance(account).toLocaleString("en-BD")}
                </h3>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3>নতুন লেনদেন যোগ করুন</h3>

        <form onSubmit={addEntry}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <select
              style={inputStyle}
              value={entryForm.entry_type}
              onChange={(e) =>
                setEntryForm({
                  ...entryForm,
                  entry_type: e.target.value,
                })
              }
            >
              <option value="income">জমা / আয়</option>
              <option value="expense">খরচ</option>
              <option value="transfer">টাকা স্থানান্তর</option>
            </select>

            {entryForm.entry_type === "transfer" ? (
              <>
                <select
                  style={inputStyle}
                  value={entryForm.from_account_id}
                  onChange={(e) =>
                    setEntryForm({
                      ...entryForm,
                      from_account_id: e.target.value,
                    })
                  }
                >
                  <option value="">যে অ্যাকাউন্ট থেকে</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name}
                    </option>
                  ))}
                </select>

                <select
                  style={inputStyle}
                  value={entryForm.to_account_id}
                  onChange={(e) =>
                    setEntryForm({
                      ...entryForm,
                      to_account_id: e.target.value,
                    })
                  }
                >
                  <option value="">যে অ্যাকাউন্টে</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                style={inputStyle}
                value={entryForm.account_id}
                onChange={(e) =>
                  setEntryForm({
                    ...entryForm,
                    account_id: e.target.value,
                  })
                }
              >
                <option value="">অ্যাকাউন্ট নির্বাচন করুন</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name}
                  </option>
                ))}
              </select>
            )}

            <input
              style={inputStyle}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="টাকার পরিমাণ"
              value={entryForm.amount}
              onChange={(e) =>
                setEntryForm({ ...entryForm, amount: e.target.value })
              }
            />

            <input
              style={inputStyle}
              placeholder="ক্যাটাগরি"
              value={entryForm.category}
              onChange={(e) =>
                setEntryForm({ ...entryForm, category: e.target.value })
              }
            />

            <input
              style={inputStyle}
              type="date"
              value={entryForm.transaction_date}
              onChange={(e) =>
                setEntryForm({
                  ...entryForm,
                  transaction_date: e.target.value,
                })
              }
            />

            <input
              style={inputStyle}
              placeholder="বিবরণ (ঐচ্ছিক)"
              value={entryForm.description}
              onChange={(e) =>
                setEntryForm({
                  ...entryForm,
                  description: e.target.value,
                })
              }
            />
          </div>

          <button
            style={{ ...buttonStyle, marginTop: 12 }}
            disabled={saving || accounts.length === 0}
          >
            {saving ? "অপেক্ষা করুন..." : "লেনদেন সংরক্ষণ করুন"}
          </button>

          {accounts.length === 0 && (
            <p>লেনদেনের আগে অন্তত একটি অ্যাকাউন্ট তৈরি করুন।</p>
          )}
        </form>
      </div>

      <div style={cardStyle}>
        <h3>লেনদেনের তালিকা</h3>

        {entries.length === 0 ? (
          <p>এখনো কোনো লেনদেন নেই।</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 650,
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>তারিখ</th>
                  <th style={{ padding: 10 }}>ধরন</th>
                  <th style={{ padding: 10 }}>বিবরণ</th>
                  <th style={{ padding: 10 }}>টাকা</th>
                  <th style={{ padding: 10 }}>কাজ</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const account = accounts.find(
                    (item) => item.id === entry.account_id
                  );
                  const fromAccount = accounts.find(
                    (item) => item.id === entry.from_account_id
                  );
                  const toAccount = accounts.find(
                    (item) => item.id === entry.to_account_id
                  );

                  const label =
                    entry.entry_type === "income"
                      ? "জমা / আয়"
                      : entry.entry_type === "expense"
                        ? "খরচ"
                        : "স্থানান্তর";

                  return (
                    <tr key={entry.id} style={{ borderTop: "1px solid #ddd" }}>
                      <td style={{ padding: 10 }}>
                        {entry.transaction_date}
                      </td>
                      <td style={{ padding: 10 }}>{label}</td>
                      <td style={{ padding: 10 }}>
                        {entry.entry_type === "transfer"
                          ? `${fromAccount?.account_name || "?"} → ${toAccount?.account_name || "?"}`
                          : account?.account_name || "—"}
                        <div style={{ color: "#777", fontSize: 13 }}>
                          {entry.category} {entry.description}
                        </div>
                      </td>
                      <td style={{ padding: 10 }}>
                        ৳ {Number(entry.amount).toLocaleString("en-BD")}
                      </td>
                      <td style={{ padding: 10 }}>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          style={{
                            border: 0,
                            background: "#fee2e2",
                            color: "#b91c1c",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          মুছুন
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={loadData}
        style={{ ...buttonStyle, marginBottom: 20 }}
      >
        তথ্য রিফ্রেশ করুন
      </button>
    </div>
  );
}
